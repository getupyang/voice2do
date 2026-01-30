/**
 * 从 WAV 文件中提取 PCM 数据
 * 要求输入为 16kHz, 16bit, 单声道 的 WAV 文件（iOS 捷径端配置）
 */
export function extractPcmFromWav(wavBuffer: Buffer): Buffer {
  // WAV 文件头至少 44 字节
  if (wavBuffer.length < 44) {
    throw new Error("无效的 WAV 文件：文件太小");
  }

  const riff = wavBuffer.toString("ascii", 0, 4);
  const wave = wavBuffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("无效的 WAV 文件：缺少 RIFF/WAVE 标识");
  }

  // 查找 "data" chunk
  let offset = 12;
  while (offset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString("ascii", offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);

    if (chunkId === "data") {
      const dataStart = offset + 8;
      const dataEnd = Math.min(dataStart + chunkSize, wavBuffer.length);
      return wavBuffer.subarray(dataStart, dataEnd);
    }

    offset += 8 + chunkSize;
  }

  throw new Error("无效的 WAV 文件：未找到 data chunk");
}
