# Voice2Do Agent Instructions

## Delivery Quality

Developers and coding agents must verify their own changes before handing work back to the user.

For every feature, bug fix, deployment change, or data-flow change:

1. Add or run an appropriate test, verification script, or minimal reproducible check for the specific requirement. If the project has no test framework, use executable commands that cover the key path.
2. Run existing quality gates such as `npm run lint`, `npm run build`, and any relevant API/component checks.
3. Proactively regress adjacent critical workflows affected by the change. For voice pipeline changes, verify request intake, audio persistence, transcription success/failure, empty-transcription safeguards, web rendering, and playback behavior.
4. For external dependencies such as iOS Shortcuts, Vercel, Supabase, iFlytek, OpenRouter, or iCloud Calendar, clearly state what was verified directly, what could not be automated, and what residual risk remains.
5. Do not rely on the user to perform first-pass testing. Final handoff must include concrete verification results, not just an expectation that the change should work.

## Existing Context

This repository also contains `CLAUDE.md`, which documents project architecture and historical collaboration rules. Use it as supporting context, but follow this file for agent delivery expectations.
