# Changelog

## [0.1.1] - 2026-11-16

### Added

- My films: named local projects with thumbnails, safe switching and recovery of the previous edit as a separate copy.
- Local HEIC/HEIF decoding and HEVC/HDR-to-SDR compatibility conversion, retaining untouched originals in portable projects.
- Placed songs and narration with source trimming, start times, duration, fades, looping and volume; optional music reduction during source-sound-enabled clips and narration.
- Microphone narration recording on the device, with permission/error handling and explicit stop/discard controls.
- Editable timed subtitles, SRT import/export and matching subtitles burned into native/browser movies.
- TV, phone and small-file export presets, approximate file size and a five-second sample export.
- Schema 2 with explicit migration of v0.1.0 projects; future schemas continue to fail visibly.

### Distribution and limits

- Windows x64, Apple Silicon/Intel macOS, Linux x64 and the browser editor. Desktop previews remain unsigned and unnotarized; signing credentials and automatic updates are outside this release.
- Browser phone-video conversion is limited to 256 MB, HEIF photos to 64 megapixels, and narration to five-minute sections. Optional automatic transcription and 4K export remain deferred.
- Browser MP4 recording remains capability-dependent; unsupported browsers can save portable projects for desktop export. Experimental WebM remains disabled (issue #8).
- Automatic slideshow creation and photo-presentation enhancements were excluded by the user's selection.

## [0.1.0] - 2026-11-16

### Added

- A local home-video and slideshow editor for Windows, macOS, Linux and the web.
- Photos, clips, music, a reorderable storyboard, trim/split, undo/redo, title cards and overlays.
- Landscape, portrait and square movies at HD and Full HD.
- Native H.264/AAC MP4 export and detected browser MP4/WebM export, with cancellation and actual progress.
- Local autosave and self-contained portable `.corto` projects with original media.
- An optional credited example, bundled fonts/icons, keyboard shortcuts and an offline web cache.
- Keel's layered tests, real encoded-movie checks, per-OS screenshots and installer round trips.

### Distribution

- Unsigned preview installers. Signing/notarization and native mobile packages are outside this release.
- No accounts, OneDrive integration, media uploads, analytics, subscriptions or watermark.
