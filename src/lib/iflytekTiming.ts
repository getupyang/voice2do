export const IFLYTEK_SAMPLE_RATE = 16000;
export const IFLYTEK_BYTES_PER_SAMPLE = 2;
export const IFLYTEK_MIN_TIMEOUT_MS = 60 * 1000;
export const IFLYTEK_TIMEOUT_PADDING_MS = 30 * 1000;

export function getIflytekTimeoutMs(pcmByteLength: number): number {
  const safeByteLength = Math.max(0, pcmByteLength);
  const durationMs = Math.ceil(
    (safeByteLength / IFLYTEK_BYTES_PER_SAMPLE / IFLYTEK_SAMPLE_RATE) * 1000
  );

  return Math.max(
    IFLYTEK_MIN_TIMEOUT_MS,
    durationMs + IFLYTEK_TIMEOUT_PADDING_MS
  );
}
