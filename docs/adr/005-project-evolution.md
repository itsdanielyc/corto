<!-- keel:start -->
# ADR 005: Project evolution and local originals
Status: accepted. Date: 2026-11-16.

The authorised v0.1.1 scope needs multiple films, placed sounds, timed subtitles and phone-compatible playback while retaining the simple storyboard.

- Write schema version 2. Parse the strict known v1 shape into v2 with empty placed sounds/subtitles and ducking off; preserve every v1 scene, original and soundtrack. Reject unknown/future schemas rather than dropping their fields.
- Keep the portable container signature `CORTO001`: its framing is unchanged; the bounded manifest carries the independent project-schema version.
- Store a compatible PNG/H.264 copy as a normal asset linked by `originalAssetId` to an `isOriginalOnly` archived asset. The archived bytes are immutable, hidden from the editing library and included in portable copies. No missing original is silently substituted.
- Store small catalogue records by opaque project ID. Save the latest distinct edit and its previous snapshot. Desktop also writes an independent recovery manifest before replacing the catalogue entry. Recovery and portable imports get fresh project identities.
- Extend the canonical typed adapter and validate native callers and identifiers. Original-file paths stay in the preload/main boundary.
- Retain the v1 single-song field for compatibility; placed sound is a bounded list with explicit source offset, film start, duration, gain, fades, loop and role. Native/browser renderers consume the same timeline semantics.
- Subtitle cues are bounded, ordered and non-overlapping. Text is rendered as pixels, never inserted into FFmpeg filter expressions.

Ruling: land the versioned contracts and persistence implementation before the new editor controls, so the shared seam has its own CI evidence. There is one implementation branch and no parallel ownership map.

Test surface: strict v1 migration/future rejection; invalid media links and audio/subtitle timing; multi-film restart/recovery including a damaged latest record; HEVC/HDR conversion with byte-identical original preservation through a portable round trip.
<!-- keel:end -->
