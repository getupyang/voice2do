import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { transcribeWithIflytek } from "@/lib/iflytek";
import { extractRawAudio, pcmToWav } from "@/lib/audio";
import { supabase } from "@/lib/supabase";
import { enhanceMemo } from "@/lib/enhance";

export async function POST(request: NextRequest) {
  let memoId: string | null = null;

  try {
    // Step 1: 解析请求，获取音频数据
    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer;
    let mimeType: string;
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

    // 从已提取的原始 PCM 重采样到 16kHz mono（复用 rawAudio，不重新解析 AIFF）
    let pcm16k = rawAudio.pcm;
    if (rawAudio.channels > 1) {
      // 立体声转单声道
      const frameSize = rawAudio.channels * 2;
      const frameCount = Math.floor(pcm16k.length / frameSize);
      const mono = Buffer.alloc(frameCount * 2);
      for (let i = 0; i < frameCount; i++) {
        let sum = 0;
        for (let ch = 0; ch < rawAudio.channels; ch++) {
          sum += pcm16k.readInt16LE(i * frameSize + ch * 2);
        }
        mono.writeInt16LE(Math.round(sum / rawAudio.channels), i * 2);
      }
      pcm16k = mono;
    }
    if (rawAudio.sampleRate !== 16000) {
      // 重采样到 16kHz
      const srcSamples = pcm16k.length / 2;
      const dstSamples = Math.round(srcSamples * 16000 / rawAudio.sampleRate);
      const dst = Buffer.alloc(dstSamples * 2);
      const ratio = rawAudio.sampleRate / 16000;
      for (let i = 0; i < dstSamples; i++) {
        const srcPos = i * ratio;
        const srcIdx = Math.floor(srcPos);
        const frac = srcPos - srcIdx;
        const s0 = srcIdx < srcSamples ? pcm16k.readInt16LE(srcIdx * 2) : 0;
        const s1 = srcIdx + 1 < srcSamples ? pcm16k.readInt16LE((srcIdx + 1) * 2) : s0;
        dst.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s0 + (s1 - s0) * frac))), i * 2);
      }
      pcm16k = dst;
    }
    console.log(`Resampled PCM: ${pcm16k.length} bytes, duration=${(pcm16k.length / 2 / 16000).toFixed(1)}s`);

    // 并行：上传 WAV + 讯飞转写
    const [uploadResult, transcribeResult] = await Promise.allSettled([
      supabase.storage.from("audio").upload(wavFileName, wavBuffer, {
        contentType: "audio/wav",
        upsert: false,
      }),
      transcribeWithIflytek(pcm16k),
    ]);

    // 处理上传结果
    let audioUrl: string | null = null;
    if (uploadResult.status === "fulfilled" && !uploadResult.value.error) {
      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(wavFileName);
      audioUrl = urlData.publicUrl;
      console.log("WAV uploaded to:", audioUrl);
    } else {
      const reason = uploadResult.status === "rejected"
        ? uploadResult.reason
        : uploadResult.value.error?.message;
      console.warn("Storage upload failed:", reason);
    }

    // 处理转写结果
    if (transcribeResult.status === "rejected") {
      console.error("Transcription failed:", transcribeResult.reason);

      await supabase
        .from("memos")
        .update({
          raw_text: "[转写失败]",
          cleaned_text: "[转写失败]",
          status: "error",
          audio_url: audioUrl,
        })
        .eq("id", memoId);

      return NextResponse.json({
        success: false,
        error: "语音转写失败: " + (transcribeResult.reason?.message || "未知错误"),
        memo_id: memoId,
        audio_uploaded: !!audioUrl,
      });
    }

    const rawText = transcribeResult.value;
    const cleanedText = rawText;
    console.log("Transcription result:", rawText.substring(0, 50));

    // Step 5: 更新数据库记录
    const { data: updatedMemo, error: updateError } = await supabase
      .from("memos")
      .update({
        raw_text: rawText,
        cleaned_text: cleanedText,
        status: "active",
        audio_url: audioUrl,
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

    // 异步调用 LLM 增强（不阻塞响应）
    if (process.env.OPENROUTER_API_KEY) {
      after(async () => {
        await enhanceMemo(memoId!, rawText);
      });
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
