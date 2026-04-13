/** 音频元信息 + PCM 数据 */
export interface AudioData {
  pcm: Buffer;          // 小端序 PCM
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

/**
 * 将 PCM 数据包装为 WAV 文件（浏览器通用格式）
 * 使用实际的采样率/声道数，不再硬编码
 */
export function pcmToWav(audio: AudioData): Buffer {
  const { pcm, sampleRate, channels, bitsPerSample } = audio;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);         // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

/**
 * 从音频文件中提取 PCM 数据和元信息
 * 支持 WAV 和 AIFF 格式
 */
export function extractAudio(audioBuffer: Buffer): AudioData {
  if (audioBuffer.length < 12) {
    throw new Error("无效的音频文件：文件太小");
  }

  const magic = audioBuffer.toString("ascii", 0, 4);

  if (magic === "RIFF") {
    return extractFromWav(audioBuffer);
  } else if (magic === "FORM") {
    return extractFromAiff(audioBuffer);
  }

  throw new Error("不支持的音频格式，请使用 WAV 或 AIFF");
}

/**
 * 兼容旧接口：只返回 PCM buffer（讯飞转写用）
 */
export function extractPcm(audioBuffer: Buffer): Buffer {
  return extractAudio(audioBuffer).pcm;
}

/**
 * 从 WAV 文件提取 PCM 和元信息（已是小端序）
 */
function extractFromWav(buf: Buffer): AudioData {
  const wave = buf.toString("ascii", 8, 12);
  if (wave !== "WAVE") {
    throw new Error("无效的 WAV 文件");
  }

  let sampleRate = 44100;
  let channels = 1;
  let bitsPerSample = 16;
  let pcm: Buffer | null = null;

  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (chunkId === "data") {
      const start = offset + 8;
      const end = Math.min(start + chunkSize, buf.length);
      pcm = buf.subarray(start, end);
    }
    offset += 8 + chunkSize;
  }

  if (!pcm) throw new Error("无效的 WAV 文件：未找到 data chunk");
  return { pcm, sampleRate, channels, bitsPerSample };
}

/**
 * 解析 AIFF 80-bit extended float 采样率
 * AIFF 用 IEEE 754 extended 存储采样率，需要手动解析
 */
function parseAiffSampleRate(buf: Buffer, offset: number): number {
  const exponent = ((buf[offset] & 0x7F) << 8) | buf[offset + 1];
  let mantissa = 0;
  for (let i = 0; i < 8; i++) {
    mantissa = mantissa * 256 + buf[offset + 2 + i];
  }
  const sign = buf[offset] & 0x80 ? -1 : 1;
  if (exponent === 0 && mantissa === 0) return 0;
  return sign * mantissa * Math.pow(2, exponent - 16383 - 63);
}

/**
 * 从 AIFF 文件提取 PCM（转小端序）和元信息
 */
function extractFromAiff(buf: Buffer): AudioData {
  const aiff = buf.toString("ascii", 8, 12);
  if (aiff !== "AIFF" && aiff !== "AIFC") {
    throw new Error("无效的 AIFF 文件");
  }

  let sampleRate = 44100;
  let channels = 1;
  let bitsPerSample = 16;
  let pcm: Buffer | null = null;

  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32BE(offset + 4);

    if (chunkId === "COMM") {
      channels = buf.readUInt16BE(offset + 8);
      bitsPerSample = buf.readUInt16BE(offset + 14);
      sampleRate = Math.round(parseAiffSampleRate(buf, offset + 16));
      console.log(`AIFF COMM: ${channels}ch, ${sampleRate}Hz, ${bitsPerSample}bit`);
    } else if (chunkId === "SSND") {
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
      pcm = littleEndian;
    }
    offset += 8 + chunkSize;
  }

  if (!pcm) throw new Error("无效的 AIFF 文件：未找到 SSND chunk");
  return { pcm, sampleRate, channels, bitsPerSample };
}
