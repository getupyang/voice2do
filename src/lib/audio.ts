/**
 * 从音频文件中提取 PCM 数据（16bit 小端序）
 * 支持 WAV 和 AIFF 格式
 */
export function extractPcm(audioBuffer: Buffer): Buffer {
  if (audioBuffer.length < 12) {
    throw new Error("无效的音频文件：文件太小");
  }

  const magic = audioBuffer.toString("ascii", 0, 4);

  if (magic === "RIFF") {
    return extractPcmFromWav(audioBuffer);
  } else if (magic === "FORM") {
    return extractPcmFromAiff(audioBuffer);
  }

  throw new Error("不支持的音频格式，请使用 WAV 或 AIFF");
}

/**
 * 从 WAV 文件提取 PCM（已是小端序）
 */
function extractPcmFromWav(buf: Buffer): Buffer {
  const wave = buf.toString("ascii", 8, 12);
  if (wave !== "WAVE") {
    throw new Error("无效的 WAV 文件");
  }

  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);

    if (chunkId === "data") {
      const start = offset + 8;
      const end = Math.min(start + chunkSize, buf.length);
      return buf.subarray(start, end);
    }
    offset += 8 + chunkSize;
  }

  throw new Error("无效的 WAV 文件：未找到 data chunk");
}

/**
 * 从 AIFF 文件提取 PCM 并转为小端序
 * AIFF 存储大端序 PCM，讯飞要求小端序
 */
function extractPcmFromAiff(buf: Buffer): Buffer {
  const aiff = buf.toString("ascii", 8, 12);
  if (aiff !== "AIFF" && aiff !== "AIFC") {
    throw new Error("无效的 AIFF 文件");
  }

  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32BE(offset + 4);

    if (chunkId === "SSND") {
      // SSND chunk: 4 bytes offset + 4 bytes blockSize, then PCM data
      const ssndOffset = buf.readUInt32BE(offset + 8);
      const start = offset + 16 + ssndOffset;
      const end = Math.min(offset + 8 + chunkSize, buf.length);
      const bigEndianPcm = buf.subarray(start, end);

      // 大端序 16bit → 小端序 16bit
      const littleEndian = Buffer.alloc(bigEndianPcm.length);
      for (let i = 0; i < bigEndianPcm.length - 1; i += 2) {
        littleEndian[i] = bigEndianPcm[i + 1];
        littleEndian[i + 1] = bigEndianPcm[i];
      }
      return littleEndian;
    }
    offset += 8 + chunkSize;
  }

  throw new Error("无效的 AIFF 文件：未找到 SSND chunk");
}
