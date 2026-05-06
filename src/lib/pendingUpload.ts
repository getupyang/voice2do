import type { Memo } from "../types";

export const WAITING_UPLOAD_TEXT = "[等待上传...]";
export const STALE_PENDING_MS = 10 * 60 * 1000;

type PendingUploadMemo = Pick<Memo, "status" | "audio_url" | "created_at"> &
  Partial<Pick<Memo, "raw_text" | "cleaned_text">>;

export function isUnfinishedVoiceUpload(
  memo: PendingUploadMemo,
  nowMs = Date.now()
): boolean {
  if (memo.status !== "pending") return false;
  if (memo.audio_url) return false;

  const rawText = memo.raw_text?.trim();
  const cleanedText = memo.cleaned_text?.trim();
  if (rawText === WAITING_UPLOAD_TEXT || cleanedText === WAITING_UPLOAD_TEXT) {
    return true;
  }

  const createdAtMs = new Date(memo.created_at).getTime();
  if (!Number.isFinite(createdAtMs)) return false;

  return nowMs - createdAtMs > STALE_PENDING_MS;
}
