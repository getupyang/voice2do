import assert from "node:assert/strict";
import test from "node:test";

import {
  getIflytekTimeoutMs,
  IFLYTEK_MIN_TIMEOUT_MS,
  IFLYTEK_TIMEOUT_PADDING_MS,
} from "../src/lib/iflytekTiming.ts";

const bytesPerSecondAt16kMono16Bit = 16000 * 2;

test("keeps short voice clips on the existing minimum timeout", () => {
  assert.equal(
    getIflytekTimeoutMs(10 * bytesPerSecondAt16kMono16Bit),
    IFLYTEK_MIN_TIMEOUT_MS
  );
});

test("gives near-limit voice clips enough time to finish real-time streaming", () => {
  assert.equal(
    getIflytekTimeoutMs(60 * bytesPerSecondAt16kMono16Bit),
    60 * 1000 + IFLYTEK_TIMEOUT_PADDING_MS
  );
});

test("handles invalid byte lengths conservatively", () => {
  assert.equal(getIflytekTimeoutMs(-1), IFLYTEK_MIN_TIMEOUT_MS);
});
