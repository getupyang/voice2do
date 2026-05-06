import assert from "node:assert/strict";
import test from "node:test";

import {
  isUnfinishedVoiceUpload,
  STALE_PENDING_MS,
  WAITING_UPLOAD_TEXT,
} from "../src/lib/pendingUpload.ts";

const now = new Date("2026-05-06T14:00:00.000Z").getTime();

function memo(overrides = {}) {
  return {
    status: "pending",
    audio_url: null,
    created_at: new Date(now).toISOString(),
    raw_text: "[转写中...]",
    cleaned_text: "[转写中...]",
    ...overrides,
  };
}

test("flags the temporary init placeholder as an unfinished upload", () => {
  assert.equal(
    isUnfinishedVoiceUpload(
      memo({ raw_text: WAITING_UPLOAD_TEXT, cleaned_text: WAITING_UPLOAD_TEXT }),
      now
    ),
    true
  );
});

test("keeps a fresh legacy /api/voice request in the transcribing state", () => {
  assert.equal(isUnfinishedVoiceUpload(memo(), now), false);
});

test("flags stale pending voice records without saved audio", () => {
  assert.equal(
    isUnfinishedVoiceUpload(
      memo({ created_at: new Date(now - STALE_PENDING_MS - 1).toISOString() }),
      now
    ),
    true
  );
});

test("does not flag pending records after audio has been saved", () => {
  assert.equal(
    isUnfinishedVoiceUpload(memo({ audio_url: "https://example.com/audio.wav" }), now),
    false
  );
});

test("does not flag non-pending records", () => {
  assert.equal(
    isUnfinishedVoiceUpload(
      memo({
        status: "error",
        raw_text: WAITING_UPLOAD_TEXT,
        cleaned_text: WAITING_UPLOAD_TEXT,
      }),
      now
    ),
    false
  );
});
