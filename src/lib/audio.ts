import { execFile } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

/**
 * 将音频转换为讯飞要求的 PCM 格式（16kHz, 16bit, 单声道）
 */
export async function convertToPcm(
  audioBuffer: Buffer,
  inputMimeType: string
): Promise<Buffer> {
  const timestamp = Date.now();
  const ext = mimeToExt(inputMimeType);
  const inputPath = join(tmpdir(), `voice2do_input_${timestamp}.${ext}`);
  const outputPath = join(tmpdir(), `voice2do_output_${timestamp}.pcm`);

  try {
    await writeFile(inputPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-i", inputPath,
          "-ar", "16000",
          "-ac", "1",
          "-f", "s16le",
          "-acodec", "pcm_s16le",
          "-y",
          outputPath,
        ],
        { timeout: 30000 },
        (error, _stdout, stderr) => {
          if (error) {
            console.error("ffmpeg stderr:", stderr);
            reject(new Error(`音频转换失败: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });

    const pcmBuffer = await readFile(outputPath);
    return pcmBuffer;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/caf": "caf",
  };
  return map[mimeType] || "m4a";
}
