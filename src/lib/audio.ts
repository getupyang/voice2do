interface PcmResult {
  pcm: Buffer;
  sampleRate: number;
  channels: number;
}

/**
 * 从音频文件中提取 PCM 数据，重采样为 16kHz 单声道 16bit 小端序
 * 支持 WAV 和 AIFF 格式
 */
export function extractPcm(audioBuffer: Buffer): Buffer {
  if (audioBuffer.length < 12) {
    throw new Error("无效的音频文件：文件太小");
  }

  const magic = audioBuffer.toString("ascii", 0, 4);

  let result: PcmResult;
  if (magic === "RIFF") {
    result = extractPcmFromWav(audioBuffer);
  } else if (magic === "FORM") {
    result = extractPcmFromAiff(audioBuffer);
  } else {
    throw new Error("不支持的音频格式，请使用 WAV 或 AIFF");
  }

  console.log(`Audio info: sampleRate=${result.sampleRate}, channels=${result.channels}, pcmBytes=${result.pcm.length}`);

  // 转为单声道（如果是立体声）
  let mono = result.pcm;
  if (result.channels > 1) {
    mono = toMono(result.pcm, result.channels);
  }

  // 重采样到 16kHz
  if (result.sampleRate !== 16000) {
    mono = resample(mono, result.sampleRate, 16000);
  }

  console.log(`After processing: pcmBytes=${mono.length}, duration=${(mono.length / 2 / 16000).toFixed(1)}s`);
  return mono;
}

/**
 * 从 WAV 文件提取 PCM
 */
function extractPcmFromWav(buf: Buffer): PcmResult {
  const wave = buf.toString("ascii", 8, 12);
  if (wave !== "WAVE") {
    throw new Error("无效的 WAV 文件");
  }

  let sampleRate = 16000;
  let channels = 1;
  let pcm: Buffer | null = null;

  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
    } else if (chunkId === "data") {
      const start = offset + 8;
      const end = Math.min(start + chunkSize, buf.length);
      pcm = buf.subarray(start, end);
    }
    offset += 8 + chunkSize;
  }

  if (!pcm) {
    throw new Error("无效的 WAV 文件：未找到 data chunk");
  }

  return { pcm, sampleRate, channels };
}

/**
 * 解析 AIFF 80-bit extended float（采样率字段）
 */
function readIeee80(buf: Buffer, off: number): number {
  const exponent = ((buf[off] & 0x7f) << 8) | buf[off + 1];
  const mantissa =
    buf[off + 2] * 0x1000000 +
    buf[off + 3] * 0x10000 +
    buf[off + 4] * 0x100 +
    buf[off + 5];
  // 简化解析，足够处理常见采样率（8000~96000）
  return mantissa * Math.pow(2, exponent - 16383 - 31);
}

/**
 * 从 AIFF 文件提取 PCM 并转为小端序
 */
function extractPcmFromAiff(buf: Buffer): PcmResult {
  const aiff = buf.toString("ascii", 8, 12);
  if (aiff !== "AIFF" && aiff !== "AIFC") {
    throw new Error("无效的 AIFF 文件");
  }

  let sampleRate = 16000;
  let channels = 1;
  let pcm: Buffer | null = null;

  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32BE(offset + 4);

    if (chunkId === "COMM") {
      channels = buf.readUInt16BE(offset + 8);
      // 采样率是 80-bit IEEE 754 extended，从 offset+16 开始
      sampleRate = readIeee80(buf, offset + 16);
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

  if (!pcm) {
    throw new Error("无效的 AIFF 文件：未找到 SSND chunk");
  }

  return { pcm, sampleRate, channels };
}

/**
 * 立体声/多声道转单声道（取各声道平均值）
 */
function toMono(pcm: Buffer, channels: number): Buffer {
  const frameSize = channels * 2; // 每帧字节数（16bit per channel）
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
