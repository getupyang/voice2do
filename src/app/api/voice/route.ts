import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { extractRawAudio, pcmToWav } from "@/lib/audio";
import { supabase } from "@/lib/supabase";
import { toPcm16kMono, transcribeMemoInBackground } from "@/lib/voicePipeline";

export async function POST(request: NextRequest) {
  let memoId: string | null = null;

  try {
    // Step 1: 解析请求，获取音频数据
    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer;
    let fileName: string;

    console.log("Received request with content-type:", contentType);

    // 设备名称，优先从表单读取（支持中文），其次从请求头读取
    let deviceName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // 处理 form-data 格式（iOS 捷径）
      const formData = await request.formData();

      // 从表单读取设备名称
      const formDeviceName = formData.get("device_name");
      if (formDeviceName && typeof formDeviceName === "string") {
        deviceName = formDeviceName;
      }

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
      fileName = file.name || `audio_${Date.now()}.m4a`;
    } else {
      // 处理原始音频数据（直接发送二进制）
      const arrayBuffer = await request.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);

      fileName = `audio_${Date.now()}.m4a`;

      // 非表单请求时，从请求头读取设备名称（支持 URL 编码）
      const rawDeviceName = request.headers.get("device_name") || request.headers.get("device-name") || null;
      if (rawDeviceName) {
        try {
          deviceName = decodeURIComponent(rawDeviceName);
        } catch {
          deviceName = rawDeviceName;
        }
      }
    }

    console.log("Audio buffer size:", audioBuffer.length, "bytes");
    console.log("Device name:", deviceName);

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "音频文件为空" },
        { status: 400 }
      );
    }

    // Step 2: 一次性提取原始音频数据（PCM + 元信息）
    console.log("Extracting audio data...");
    let rawAudio: ReturnType<typeof extractRawAudio>;
    try {
      rawAudio = extractRawAudio(audioBuffer);
      console.log(`Audio: ${rawAudio.sampleRate}Hz, ${rawAudio.channels}ch, ${rawAudio.bitsPerSample}bit, PCM ${rawAudio.pcm.length} bytes`);
    } catch (extractError) {
      console.error("Audio extraction failed:", extractError);
      return NextResponse.json(
        { success: false, error: "音频格式不支持: " + (extractError instanceof Error ? extractError.message : "未知错误") },
        { status: 400 }
      );
    }

    // Step 3: 先创建 DB 记录（让 iOS 捷径尽快得到响应的前置条件）
    const { data: memoData, error: insertError } = await supabase
      .from("memos")
      .insert({
        raw_text: "[转写中...]",
        cleaned_text: "[转写中...]",
        intent: "memo",
        status: "pending",
        device_id: deviceName,
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

    // Step 4: WAV 上传和讯飞转写并行执行（两者互不依赖）
    const wavBuffer = pcmToWav(rawAudio);
    const wavFileName = `uploads/${Date.now()}_${fileName.replace(/\.\w+$/, "")}.wav`;

    const pcm16k = toPcm16kMono(rawAudio);
    console.log(`Resampled PCM: ${pcm16k.length} bytes, duration=${(pcm16k.length / 2 / 16000).toFixed(1)}s`);

    // 先保证音频保存成功，再尽快响应手机端；转写在后台继续。
    const uploadResult = await supabase.storage.from("audio").upload(wavFileName, wavBuffer, {
      contentType: "audio/wav",
      upsert: false,
    });

    if (uploadResult.error) {
      console.error("Storage upload failed:", uploadResult.error.message);
      await supabase
        .from("memos")
        .update({
          raw_text: "[音频上传失败]",
          cleaned_text: "[音频上传失败]",
          status: "error",
        })
        .eq("id", memoId);

      return NextResponse.json(
        {
          success: false,
          error: "语音文件上传失败: " + uploadResult.error.message,
          memo_id: memoId,
        },
        { status: 502 }
      );
    }

    const { data: urlData } = supabase.storage.from("audio").getPublicUrl(wavFileName);
    const audioUrl = urlData.publicUrl;
    console.log("WAV uploaded to:", audioUrl);

    const { error: updateError } = await supabase
      .from("memos")
      .update({
        audio_url: audioUrl,
      })
      .eq("id", memoId);

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json(
        { success: false, error: "数据库更新失败" },
        { status: 500 }
      );
    }

    after(async () => {
      await transcribeMemoInBackground(memoId!, pcm16k, audioUrl);
    });

    return NextResponse.json({
      success: true,
      message: "录音已保存，正在后台转写",
      data: {
        id: memoId,
        raw_text: memoData.raw_text,
        cleaned_text: memoData.cleaned_text,
        audio_url: audioUrl,
        created_at: memoData.created_at,
        status: "pending",
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
