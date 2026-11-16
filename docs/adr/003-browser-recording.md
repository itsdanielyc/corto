<!-- keel:start -->
# ADR 003: Finalize browser WebM recordings
Status: accepted. Date: 2026-11-16.

Linux browser testing exposed an actual MediaRecorder difference: the supported output was WebM, whose streaming container omitted duration metadata. Desktop MP4 and Windows browser MP4 were unaffected. The encoded-output test correctly rejected an unfinalized movie instead of weakening its duration assertion.

Finalize WebM with `webm-duration-fix` 1.0.4 in a dedicated worker. Its implementation consumes `Blob.stream()` and replaces metadata with a seekable header/cues rather than reading the entire movie into an ArrayBuffer. Worker termination makes cancellation responsive during finalization. MP4 recordings bypass it.

Rejected: a full-file parser (another complete movie allocation), browser FFmpeg/WASM (payload and cross-origin isolation requirements), and removing the duration check (hides a real defect).

Test automatically detected output and forced WebM fallback on every browser runner. The production offline journey exports WebM, proving that the worker is bundled and cached. Inspect real output metadata, captions and both audio sources. Desktop export uses the verified native binary.

Ruling: the release fallback is VP8/Opus for broad compatibility and lower encoding cost. Investigation of intermittent fast-seek failures found that the upstream reader indexes every cluster, even when its first video block is an interframe. Corto filters cues to independently decodable clusters while preserving media payloads. A captured regression recording and repeated codec journeys prove the fix. MP4 requests an AVC level suitable for 1080p.

References inspected: [upstream streaming implementation](https://github.com/buynao/webm-duration-fix/blob/main/src/index.ts), [Matroska duration definitions](https://www.matroska.org/technical/notes.html), 2026-11-16. CommonJS default-export compatibility is isolated in the worker entry.
<!-- keel:end -->
