# Changelog

## [Unreleased]

### Fixed

- "Fade through black" no longer turns title cards and other plain-colour scenes green in exported movies, GIFs and web exports; photo fades keep their colours.
- Exports and five-second samples that start partway through a transition keep their sound, and no longer fail when the film has music.
- Animated picture-in-picture and shape layers that shrink no longer leave a smear of earlier frames, and rotated layers that grow are no longer clipped.
- Slide, push, zoom and blur transitions now look the same in the preview as in the exported movie.

## [0.1.2] - 2026-11-17

### Added

- Editable slideshows from folders/selections, music fitting and beat alignment, themes and ready-to-edit project templates.
- Photo motion, rotation/flips, focal crop, blur fill, colour/auto-enhance and local subject cut-outs; video speed/pitch, visual trim, reverse, stabilisation, shot detection, proxies and frame/audio extraction.
- Adjustable overlapping transitions, multiple styled/animated titles, rolling credits, subtitle styles, shapes/stickers, picture-in-picture, collage, chroma key and imported LUTs.
- Original CC0 music/SFX, measured waveforms and sound lanes, clip fades/boost, noise/loudness processing and M4A/WAV export.
- Optional local Whisper caption drafts and cached model downloads; photos, speech and footage stay on the device.
- Multi-selection, clipboard/settings copy, context menus, proportional timeline/ruler/zoom, markers/chapters/groups, folder capture/import and replace/relink/cleanup tools.
- 4K, frame-rate choices, export selection/range/playhead sample, GIF, quality/destination controls, probed hardware encoding with software fallback, bounded threads and background export queue.
- Film rename/duplicate/delete, 30 metadata versions, project defaults, English/Spanish, opt-in release checks and `.corto` file-open integration.

### Changed and fixed

- Browser movies use the bundled local WebAssembly encoder with deterministic frame/audio timing.
- Schema 3 migrates known older projects explicitly and uses one canonical placed-sound model. Future schemas fail visibly.
- Limits rise to 1,000 scenes, three hours, 2,500 assets and 64 GB per project; 8 GB per asset. Raster layers stage incrementally instead of sharing a 32 MB aggregate ceiling.
- GIF/TIFF/SVG and legacy camcorder/video import retain originals; unused empty drafts, insertion targets and save/recovery status are corrected.

### Distribution and limits

- Desktop previews remain unsigned/unnotarized because no publisher certificates are configured. Credential-gated signing is prepared; update checks link to releases and never silently install them.
- Browser codec budgets: 256 MB per source and 512 MB working files. Local models require an explicit initial download; cut-out copies are bounded to 4K. Experimental WebM remains advisory (issue #8).

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
