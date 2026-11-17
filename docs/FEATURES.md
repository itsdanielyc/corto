# Creator-tools feature traceability

Source: user-provided `Corto-missing-features.md`, dated 16 November 2026; implementation authorised 17 November 2026. Competitor claims remain supplied research, not our independent verification. Slideshow and photo presentation are explicitly included. Status requires a concrete implementation and named verification; hardware/model/external-signing limitations remain visible.

| ID | Area | Audience / priority | Requested capability | Status / evidence |
|---|---|---|---|---|
| F01 | Photos (the heart of a slideshow maker) | B · P1 | Pan and zoom (Ken Burns), with Apply to all and an "automatic" random option. | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F02 | Photos (the heart of a slideshow maker) | B · P1 | Rotate 90° / flip. | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F03 | Photos (the heart of a slideshow maker) | B · P1 | Crop or focal point. | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F04 | Photos (the heart of a slideshow maker) | B · P1 | Blurred-background fill for "Fit whole image". | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F05 | Photos (the heart of a slideshow maker) | B · P2 | Filters and basic adjustments (brightness, contrast, saturation, warmth, B&W/sepia, auto-enhance). | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F06 | Photos (the heart of a slideshow maker) | B · P2 | Per-photo default duration preference, and bulk "set duration for selected or all". | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F07 | Photos (the heart of a slideshow maker) | I · P3 | Capture-date sort and an optional date or EXIF caption. | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F08 | Photos (the heart of a slideshow maker) | I · P3 | Background removal (photo subject cut-out). | Implemented; real local models + offline restart; four-OS model matrix 44024156161; final CI pending |
| F09 | Video clips | B · P1 | Speed control (slow motion, fast forward, with pitch preserve). | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F10 | Video clips | B · P1 | Visual trimming. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F11 | Video clips | B · P2 | Detach or extract audio from video, so the sound becomes a placed sound. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F12 | Video clips | B · P2 | Freeze frame and "save frame as photo". | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F13 | Video clips | I · P2 | Stabilise. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F14 | Video clips | I · P2 | Reverse. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F15 | Video clips | I · P3 | Automatic scene detection to split a long camcorder or phone file into shots. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F16 | Video clips | I · P3 | Video crop and zoom, for example punching in on a face. | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F17 | Transitions | B · P1 | Cross-dissolve. | Implemented; overlap planner + transition UI; L1/L3/L4; final CI pending |
| F18 | Transitions | B · P1 | Adjustable transition duration. | Implemented; overlap planner + transition UI; L1/L3/L4; final CI pending |
| F19 | Transitions | B · P1 | Apply a transition to all scenes. | Implemented; overlap planner + transition UI; L1/L3/L4; final CI pending |
| F20 | Transitions | B · P2 | A modest transition set: dissolve, fade to or from white, wipe, slide, push, zoom, blur. | Implemented; overlap planner + transition UI; L1/L3/L4; final CI pending |
| F21 | Text and titles | B · P1 | Text that can appear for part of a scene, and more than one text per scene. | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F22 | Text and titles | B · P1 | Font, colour, size, alignment, outline or shadow, and a background box. | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F23 | Text and titles | B · P1 | Text animation presets (fade, slide, typewriter, pop). | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F24 | Text and titles | B · P1 | Rolling end credits, with presets such as "Directed by", "Starring" and "In loving memory". | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F25 | Text and titles | B · P2 | Top position and free placement. | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F26 | Text and titles | B · P2 | A custom background for title cards (any colour, gradient, or a blurred photo). | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F27 | Text and titles | B · P2 | Longer text. | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F28 | Text and titles | B · P2 | Option to turn off the automatic darkening gradient that every photo caption gets. | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F29 | Text and titles | I · P2 | Title templates or packs (intro, chapter, birthday, memorial, holiday). | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F30 | Text and titles | I · P2 | Subtitle styling (size, position, background). | Implemented; timed text/credits/subtitle rasters; L1/L3/L4/L6; final CI pending |
| F31 | Text and titles | I · P3 | Offline automatic captions (local Whisper). | Implemented; real local models + offline restart; four-OS model matrix 44024156161; final CI pending |
| F32 | Audio | B · P1 | A small bundled royalty-free music and sound-effects library. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F33 | Audio | B · P1 | Sounds visible on the storyboard, with waveforms. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F34 | Audio | B · P1 | "Fit photos to music length" / beat sync. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F35 | Audio | B · P2 | Fade in and out on a video clip's own audio. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F36 | Audio | B · P2 | Volume boost above 100%. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F37 | Audio | I · P2 | Noise reduction for narration and clips. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F38 | Audio | I · P2 | Normalise or match loudness across clips. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F39 | Audio | I · P3 | Audio-only export (for example, the narration on its own). | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F40 | Audio | I · P3 | Remove the duplicate music systems. | Implemented; canonical sounds, analysis/processing and audio output; L1/L3/L4/L6; final CI pending |
| F41 | Overlays, layers and effects | B · P2 | Stickers, emoji, arrows and shapes. | Implemented; overlay/text controls, shader/filter plans; L1/L3/L4/L6; final CI pending |
| F42 | Overlays, layers and effects | B · P2 | Picture-in-picture, or one overlay layer for an image, logo or video on top. | Implemented; overlay/text controls, shader/filter plans; L1/L3/L4/L6; final CI pending |
| F43 | Overlays, layers and effects | I · P2 | Split screen / collage ("then and now"). | Implemented; overlay/text controls, shader/filter plans; L1/L3/L4/L6; final CI pending |
| F44 | Overlays, layers and effects | I · P3 | Green screen. | Implemented; overlay/text controls, shader/filter plans; L1/L3/L4/L6; final CI pending |
| F45 | Overlays, layers and effects | I · P3 | Simple start-and-end keyframes for position, zoom and opacity. | Implemented; overlay/text controls, shader/filter plans; L1/L3/L4/L6; final CI pending |
| F46 | Overlays, layers and effects | I · P3 | Looks or LUT import. | Implemented; overlay/text controls, shader/filter plans; L1/L3/L4/L6; final CI pending |
| F47 | Automation and templates | B · P1 | Auto-slideshow from a folder or selection. | Implemented; editable slideshow/themes/project templates; L1/L4; final CI pending |
| F48 | Automation and templates | B · P2 | Themes that set transitions, title style, filter and music together (holiday, birthday, memorial, wedding). | Implemented; editable slideshow/themes/project templates; L1/L4; final CI pending |
| F49 | Automation and templates | I · P3 | Project templates ("start from a birthday film"). | Implemented; editable slideshow/themes/project templates; L1/L4; final CI pending |
| F50 | Editing workflow | B · P1 | Insert where I am. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F51 | Editing workflow | B · P1 | Multi-select (Shift- or Ctrl-click) with bulk delete, move, duration, transition and fit. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F52 | Editing workflow | B · P1 | Standard shortcuts. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F53 | Editing workflow | B · P2 | Right-click context menus on scenes and library items. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F54 | Editing workflow | B · P2 | A timeline view option with a time ruler, zoom and proportional scene widths. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F55 | Editing workflow | I · P2 | Copy and paste scene settings (style, transition, filter) to other scenes. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F56 | Editing workflow | I · P3 | Markers / chapters, and grouping scenes into sections. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F57 | Editing workflow | I · P3 | Proxy or optimised media for smooth 4K preview. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F58 | Media library | B · P1 | Remove media from a project. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F59 | Media library | B · P1 | Import legacy video: WMV, AVI, MKV, MTS/M2TS (AVCHD), 3GP, VOB. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F60 | Media library | B · P2 | GIF, TIFF and SVG images. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F61 | Media library | B · P2 | Replace media (swap a photo, keep its timing and caption) and relink a missing original. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F62 | Media library | B · P2 | Library sorting (name, date, type) and used/unused markers. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F63 | Media library | I · P3 | Folder import. | Implemented; editing/controller/library/timeline tools; L1/L3/L4; final CI pending |
| F64 | Media library | I · P3 | Webcam and screen recording. | Implemented; typed media/capture services; L3/L4/L6; physical devices unverified; final CI pending |
| F65 | Export | B · P2 | 4K export. | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F66 | Export | B · P2 | Frame-rate choice (24/25/30/60), or "match source". | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F67 | Export | B · P2 | Export a selection or range, and a sample around the playhead. | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F68 | Export | B · P2 | Hardware-accelerated and multi-threaded export. | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F69 | Export | I · P2 | GIF export. | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F70 | Export | I · P2 | Save the current frame as an image. | Implemented; `PictureTools`, shared composition; L1/L3/L4/L6; final CI pending |
| F71 | Export | I · P3 | More aspect ratios: 4:5 (Instagram feed), 4:3 (old footage), 21:9 / 2.35:1 (ffDiaporama has it). | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F72 | Export | I · P3 | A custom quality slider, and named destination presets (YouTube, Instagram, WhatsApp, email). | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F73 | Export | I · P3 | Export in the background, so you can keep editing, plus an export queue. | Implemented; immutable export queue + shared native/WASM output; L1/L3/L4/L6; hardware availability probed; final CI pending |
| F74 | Projects and app | B · P1 | Delete, rename and duplicate ("Save as") films from My films. | Implemented; catalogue/history/defaults; L1/L3/L4/L6; final CI pending |
| F75 | Projects and app | B · P1 | Double-click a `.corto` file to open it. | Implemented; OS file association + cold path import; L6 locally; L7 metadata proof pending; final CI pending |
| F76 | Projects and app | B · P1 | Signed installers and an update channel. | Partial external prerequisite: update channel and credential-gated signing configured; trusted signing unavailable without publisher certificates; final CI pending |
| F77 | Projects and app | B · P1 | Raise the limits that real tributes hit. | Implemented; 500-photo edit and 125s encoded movie; four-OS matrix 44024156161; final CI pending |
| F78 | Projects and app | B · P2 | Localisation. | Implemented; English/Spanish preference and personal-text preservation; L1/L4; final CI pending |
| F79 | Projects and app | I · P2 | Version history (more than one recovery snapshot). | Implemented; catalogue/history/defaults; L1/L3/L4/L6; final CI pending |
| F80 | Projects and app | I · P3 | Project-wide defaults: photo duration, transition, fit, title style and background. | Implemented; catalogue/history/defaults; L1/L3/L4/L6; final CI pending |

## Findings to resolve
| ID | Finding | Status / evidence |
|---|---|---|
| B01 | GIF schema/import/picker agreement and deterministic animation | implemented; Animated GIF imports to seekable video; real two-colour decoded frames (L3); final CI pending |
| B02 | Example does not retain an untouched empty draft | implemented; Empty untouched drafts are not saved; example/recovery journeys (L4); final CI pending |
| B03 | Desktop import uses bundled FFmpeg for unsupported browser codecs | implemented; Bundled FFmpeg converts legacy AVI with untouched original bytes (L3); final CI pending |
| B04 | Thread use follows a bounded machine/user budget | implemented; Probed encoders, bounded automatic/manual threads and software fallback (L1/L6); final CI pending |
| B05 | One canonical placed-sound model and one editor path | resolved: one canonical sound model; CI 43996516140 |
| B06 | Long-caption export stages bounded raster data instead of an aggregate PNG cap | implemented; Incremental raster staging passes forty PNGs beyond the former aggregate limit (L3); final CI pending |

## External dependencies
Trusted Windows/macOS signing needs the publisher's certificates; the repository currently has no configured secrets. Configuration and update checking can be implemented autonomously; an OS-trusted identity cannot be invented or purchased under the existing authorisation. Optional model downloads must be explicit and source/licence-pinned; media never goes to a transcription or image service.
