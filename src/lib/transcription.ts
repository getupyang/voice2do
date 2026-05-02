const MEANINGFUL_TRANSCRIPTION_PATTERN = /[A-Za-z0-9\u3400-\u9FFF]/;

export function hasMeaningfulTranscription(text: string | null | undefined): boolean {
  return typeof text === "string" && MEANINGFUL_TRANSCRIPTION_PATTERN.test(text.trim());
}

export function normalizeTranscription(text: string): string {
  return text.trim();
}
