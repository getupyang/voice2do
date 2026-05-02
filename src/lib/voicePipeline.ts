import { extractRawAudio, pcmToWav } from "./audio";
import { enhanceMemo } from "./enhance";
import { transcribeWithIflytek } from "./iflytek";
import { supabase } from "./supabase";
import { hasMeaningfulTranscription, normalizeTranscription } from "./transcription";

export function toPcm16kMono(rawAudio: ReturnType<typeof extractRawAudio>): Buffer {
  let pcm16k = rawAudio.pcm;

  if (rawAudio.channels > 1) {
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

  return pcm16k;
}

export async function transcribeMemoInBackground(
  memoId: string,
  pcm16k: Buffer,
  audioUrl: string
): Promise<void> {
  try {
    const rawText = normalizeTranscription(await transcribeWithIflytek(pcm16k));
    if (!hasMeaningfulTranscription(rawText)) {
      console.error("Transcription returned empty text");
      await supabase
        .from("memos")
        .update({
          raw_text: "[未识别到有效语音]",
          cleaned_text: "[未识别到有效语音]",
          status: "error",
          audio_url: audioUrl,
        })
        .eq("id", memoId);
      return;
    }

    console.log("Transcription result:", rawText.substring(0, 50));
    const { error: updateError } = await supabase
      .from("memos")
      .update({
        raw_text: rawText,
        cleaned_text: rawText,
        status: "active",
        audio_url: audioUrl,
      })
      .eq("id", memoId);

    if (updateError) {
      console.error("Database update error:", updateError);
      return;
    }

    if (process.env.OPENROUTER_API_KEY) {
      await enhanceMemo(memoId, rawText);
    }
  } catch (error) {
    console.error("Transcription failed:", error);
    await supabase
      .from("memos")
      .update({
        raw_text: "[转写失败]",
        cleaned_text: "[转写失败]",
        status: "error",
        audio_url: audioUrl,
      })
      .eq("id", memoId);
  }
}

export async function processUploadedVoice(
  memoId: string,
  sourcePath: string
): Promise<void> {
  try {
    const { data: sourceBlob, error: downloadError } = await supabase
      .storage
      .from("audio")
      .download(sourcePath);

    if (downloadError || !sourceBlob) {
      throw new Error(downloadError?.message || "源音频下载失败");
    }

    const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());
    const rawAudio = extractRawAudio(sourceBuffer);
    const wavBuffer = pcmToWav(rawAudio);
    const wavPath = `uploads/${Date.now()}_${memoId}.wav`;

    const uploadResult = await supabase.storage.from("audio").upload(wavPath, wavBuffer, {
      contentType: "audio/wav",
      upsert: false,
    });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message);
    }

    const { data: urlData } = supabase.storage.from("audio").getPublicUrl(wavPath);
    const audioUrl = urlData.publicUrl;
    const pcm16k = toPcm16kMono(rawAudio);

    console.log(`Uploaded WAV for ${memoId}: ${audioUrl}`);
    await supabase
      .from("memos")
      .update({
        raw_text: "[转写中...]",
        cleaned_text: "[转写中...]",
        status: "pending",
        audio_url: audioUrl,
      })
      .eq("id", memoId);

    await transcribeMemoInBackground(memoId, pcm16k, audioUrl);
  } catch (error) {
    console.error("Voice processing failed:", error);
    await supabase
      .from("memos")
      .update({
        raw_text: "[处理失败]",
        cleaned_text: "[处理失败]",
        status: "error",
      })
      .eq("id", memoId);
  }
}
