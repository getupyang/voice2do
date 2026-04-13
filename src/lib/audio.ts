/** 原始音频元信息 + PCM 数据 */
interface RawAudio {
  pcm: Buffer;          // 小端序 PCM
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

/**
 * 将原始 PCM 数据包装为 WAV 文件（浏览器通用格式）
 * 保留原始采样率和声道数，确保播放音调正确
 */
export function pcmToWav(audio: RawAudio): Buffer {
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
 * 提取原始音频数据（保留原始采样率/声道数）
 * 用于生成浏览器可播放的 WAV
 */
export function extractRawAudio(audioBuffer: Buffer): RawAudio {
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
 * 提取 PCM 并重采样为 16kHz 单声道 16bit 小端序
 * 用于讯飞语音转写
 */
export function extractPcm(audioBuffer: Buffer): Buffer {
  const raw = extractRawAudio(audioBuffer);

  console.log(`Audio info: sampleRate=${raw.sampleRate}, channels=${raw.channels}, pcmBytes=${raw.pcm.length}`);

  // 转为单声道（如果是立体声）
  let mono = raw.pcm;
  if (raw.channels > 1) {
    mono = toMono(raw.pcm, raw.channels);
  }

  // 重采样到 16kHz
  if (raw.sampleRate !== 16000) {
    mono = resample(mono, raw.sampleRate, 16000);
  }

  console.log(`After processing: pcmBytes=${mono.length}, duration=${(mono.length / 2 / 16000).toFixed(1)}s`);
  return mono;
}

/**
 * 从 WAV 文件提取 PCM 和元信息（已是小端序）
 */
function extractFromWav(buf: Buffer): RawAudio {
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
 */
function readIeee80(buf: Buffer, off: number): number {
  const exponent = ((buf[off] & 0x7F) << 8) | buf[off + 1];
  let mantissa = 0;
  for (let i = 0; i < 8; i++) {
    mantissa = mantissa * 256 + buf[off + 2 + i];
  }
  const sign = buf[off] & 0x80 ? -1 : 1;
  if (exponent === 0 && mantissa === 0) return 0;
  return sign * mantissa * Math.pow(2, exponent - 16383 - 63);
}

/**
 * 从 AIFF 文件提取 PCM（转小端序）和元信息
 */
function extractFromAiff(buf: Buffer): RawAudio {
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
      sampleRate = Math.round(readIeee80(buf, offset + 16));
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

/**
 * 立体声/多声道转单声道（取各声道平均值）
 */
function toMono(pcm: Buffer, channels: number): Buffer {
  const frameSize = channels * 2;
  const frameCount = Math.floor(pcm.length / frameSize);
  const mono = Buffer.alloc(frameCount * 2);

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      sum += pcm.readInt16LE(i * frameSize + ch * 2);
    }
    mono.writeInt16LE(Math.round(sum / channels), i * 2);
  }

  return mono;
}

/**
 * 简单线性插值重采样
 */
function resample(pcm: Buffer, fromRate: number, toRate: number): Buffer {
  const srcSamples = pcm.length / 2;
  const dstSamples = Math.round(srcSamples * toRate / fromRate);
  const dst = Buffer.alloc(dstSamples * 2);
  const ratio = fromRate / toRate;

  for (let i = 0; i < dstSamples; i++) {
    const srcPos = i * ratio;
    const srcIdx = Math.floor(srcPos);
    const frac = srcPos - srcIdx;

    const s0 = srcIdx < srcSamples ? pcm.readInt16LE(srcIdx * 2) : 0;
    const s1 = srcIdx + 1 < srcSamples ? pcm.readInt16LE((srcIdx + 1) * 2) : s0;
    const value = Math.round(s0 + (s1 - s0) * frac);

    dst.writeInt16LE(Math.max(-32768, Math.min(32767, value)), i * 2);
  }

  return dst;
}
