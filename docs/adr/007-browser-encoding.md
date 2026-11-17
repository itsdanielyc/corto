# ADR 007: deterministic local browser encoding

Status: accepted, implementation verification in progress.

The v0.1.1 browser path recorded a real-time canvas/audio stream. Hosted macOS
produced a short MP4 without audio once in 30 repeated runs. Switching to the
output audio clock avoided that particular assumption but still produced five
failures in 20 runs, including stalled exports and an 8.2-second file for a
1.75-second film (44008841325). Neither clock is a reliable encoded timeline.

Use the already bundled single-thread FFmpeg WASM worker for normal browser
exports. Native and browser adapters consume the same pure scene/filter/sound
plans and integer frame budgets. A browser body is divided into bounded parts
without restarting animation phase. Captions and shapes use the shared raster
renderer. No media upload, new account or remote encoder is introduced.

The browser has explicit source, raster and working-memory budgets; large jobs
explain the desktop/portable-project path. Native exports retain disk-backed
staging and streaming source access. Experimental WebM capture remains an
advisory path under issue #8, with its existing assertions retained.

The new export path must pass actual encoded frame/audio assertions and 20 clean
macOS repetitions before the recording quarantine (#15) is retired. A capture
API's availability no longer determines whether local MP4 encoding is possible.
