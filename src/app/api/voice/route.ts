import { NextRequest, NextResponse } from "next/server";
import { transcribeWithIflytek } from "@/lib/iflytek";
import { extractAudio, pcmToWav } from "@/lib/audio";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  let memoId: string | null = null;

  try {
    // Step 1: 解析请求，获取音频数据
    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer;
    let mimeType: string;
    let fileName: string;

    console.log("Received request with content-type:", contentType);

    if (contentType.includes("multipart/form-data")) {
      // 处理 form-data 格式（iOS 捷径）
      const formData = await request.formData();

      // 记录所有字段用于调试
      const fields: string[] = [];
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          fields.push(`${key}: File(${value.name}, ${value.type}, ${value.size} bytes)`);
        } else {
          fields.push(`${key}: ${typeof value}`);
        }
      }
      console.log("FormData fields:", fields);

      // 查找文件字段
      let file: File | null = null;
      for (const [, value] of formData.entries()) {
        if (value instanceof File) {
          file = value;
          break;
        }
      }

      if (!file) {
        return NextResponse.json(
          { success: false, error: "缺少音频文件", debug: { fields } },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type || "audio/m4a";
      fileName = file.name || `audio_${Date.now()}.m4a`;
    } else {
      // 处理原始音频数据（直接发送二进制）
      const arrayBuffer = await request.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);

      if (contentType.includes("audio/")) {
        mimeType = contentType.split(";")[0].trim();
      } else {
        mimeType = "audio/m4a";
      }
      fileName = `audio_${Date.now()}.m4a`;
    }

    console.log("Audio buffer size:", audioBuffer.length, "bytes");

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "音频文件为空" },
        { status: 400 }
      );
    }

    // Step 2: 提取 PCM 和音频元信息（采样率、声道数等）
    console.log("Extracting audio data...");
    let audioData: Awaited<ReturnType<typeof extractAudio>>;
    try {
      audioData = extractAudio(audioBuffer);
      console.log(`Audio: ${audioData.sampleRate}Hz, ${audioData.channels}ch, ${audioData.bitsPerSample}bit, PCM ${audioData.pcm.length} bytes`);
    } catch (extractError) {
      console.error("Audio extraction failed:", extractError);
      return NextResponse.json(
        { success: false, error: "音频格式不支持: " + (extractError instanceof Error ? extractError.message : "未知错误") },
        { status: 400 }
      );
    }

    // Step 3: 生成 WAV 并上传到 Supabase Storage（用实际采样率，浏览器可播放）
    const wavBuffer = pcmToWav(audioData);
    const wavFileName = `uploads/${Date.now()}_${fileName.replace(/\.\w+$/, "")}.wav`;
    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(wavFileName, wavBuffer, {
        contentType: "audio/wav",
        upsert: false,
      });

    let audioUrl: string | null = null;
    if (uploadError) {
      console.warn("Storage upload failed:", uploadError.message);
    } else {
      const { data: urlData } = supabase.storage
        .from("audio")
        .getPublicUrl(wavFileName);
      audioUrl = urlData.publicUrl;
      console.log("WAV uploaded to:", audioUrl);
    }

    // Step 4: 创建数据库记录（状态为 pending）
    const { data: memoData, error: insertError } = await supabase
      .from("memos")
      .insert({
        raw_text: "[转写中...]",
        cleaned_text: "[转写中...]",
        intent: "memo",
        status: "pending",
        audio_url: audioUrl,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json(
        { success: false, error: "数据库存储失败: " + insertError.message },
        { status: 500 }
      );
    }

    memoId = memoData.id;
    console.log("Created memo with id:", memoId);

    // Step 5: 调用讯飞转写
    let rawText: string;
    let cleanedText: string;

    try {
      console.log("Calling iFlytek transcription...");
      rawText = await transcribeWithIflytek(audioData.pcm);
      cleanedText = rawText;
      console.log("Transcription result:", rawText.substring(0, 50));
    } catch (transcribeError) {
      console.error("Transcription failed:", transcribeError);

      await supabase
        .from("memos")
        .update({
          raw_text: "[转写失败]",
          cleaned_text: "[转写失败]",
          status: "error",
        })
        .eq("id", memoId);

      return NextResponse.json({
        success: false,
        error:
          "语音转写失败: " +
          (transcribeError instanceof Error
            ? transcribeError.message
            : "未知错误"),
        memo_id: memoId,
        audio_uploaded: !!audioUrl,
      });
    }

    // Step 6: 更新数据库记录
    const { data: updatedMemo, error: updateError } = await supabase
      .from("memos")
      .update({
        raw_text: rawText,
        cleaned_text: cleanedText,
        status: "active",
      })
      .eq("id", memoId)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json(
        { success: false, error: "数据库更新失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedMemo.id,
        raw_text: updatedMemo.raw_text,
        cleaned_text: updatedMemo.cleaned_text,
        audio_url: audioUrl,
        created_at: updatedMemo.created_at,
      },
    });
  } catch (error) {
    console.error("Voice API error:", error);

    // 如果已创建记录但后续失败，更新状态
    if (memoId) {
      await supabase
        .from("memos")
        .update({ status: "error" })
        .eq("id", memoId);
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "处理失败",
        memo_id: memoId,
      },
      { status: 500 }
    );
  }
}
