# Creator-tools feature traceability

Source: user-provided `Corto-missing-features.md`, dated 16 November 2026; implementation authorised 17 November 2026. Competitor claims remain supplied research, not our independent verification. Slideshow and photo presentation are explicitly included. Status requires a concrete implementation and named verification; hardware/model/external-signing limitations remain visible.

| ID | Area | Audience / priority | Requested capability | Status / evidence |
|---|---|---|---|---|
| F01 | Photos (the heart of a slideshow maker) | B · P1 | Pan and zoom (Ken Burns), with Apply to all and an "automatic" random option. | planned |
| F02 | Photos (the heart of a slideshow maker) | B · P1 | Rotate 90° / flip. | planned |
| F03 | Photos (the heart of a slideshow maker) | B · P1 | Crop or focal point. | planned |
| F04 | Photos (the heart of a slideshow maker) | B · P1 | Blurred-background fill for "Fit whole image". | planned |
| F05 | Photos (the heart of a slideshow maker) | B · P2 | Filters and basic adjustments (brightness, contrast, saturation, warmth, B&W/sepia, auto-enhance). | planned |
| F06 | Photos (the heart of a slideshow maker) | B · P2 | Per-photo default duration preference, and bulk "set duration for selected or all". | planned |
| F07 | Photos (the heart of a slideshow maker) | I · P3 | Capture-date sort and an optional date or EXIF caption. | planned |
| F08 | Photos (the heart of a slideshow maker) | I · P3 | Background removal (photo subject cut-out). | planned |
| F09 | Video clips | B · P1 | Speed control (slow motion, fast forward, with pitch preserve). | planned |
| F10 | Video clips | B · P1 | Visual trimming. | planned |
| F11 | Video clips | B · P2 | Detach or extract audio from video, so the sound becomes a placed sound. | planned |
| F12 | Video clips | B · P2 | Freeze frame and "save frame as photo". | planned |
| F13 | Video clips | I · P2 | Stabilise. | planned |
| F14 | Video clips | I · P2 | Reverse. | planned |
| F15 | Video clips | I · P3 | Automatic scene detection to split a long camcorder or phone file into shots. | planned |
| F16 | Video clips | I · P3 | Video crop and zoom, for example punching in on a face. | planned |
| F17 | Transitions | B · P1 | Cross-dissolve. | planned |
| F18 | Transitions | B · P1 | Adjustable transition duration. | planned |
| F19 | Transitions | B · P1 | Apply a transition to all scenes. | planned |
| F20 | Transitions | B · P2 | A modest transition set: dissolve, fade to or from white, wipe, slide, push, zoom, blur. | planned |
| F21 | Text and titles | B · P1 | Text that can appear for part of a scene, and more than one text per scene. | planned |
| F22 | Text and titles | B · P1 | Font, colour, size, alignment, outline or shadow, and a background box. | planned |
| F23 | Text and titles | B · P1 | Text animation presets (fade, slide, typewriter, pop). | planned |
| F24 | Text and titles | B · P1 | Rolling end credits, with presets such as "Directed by", "Starring" and "In loving memory". | planned |
| F25 | Text and titles | B · P2 | Top position and free placement. | planned |
| F26 | Text and titles | B · P2 | A custom background for title cards (any colour, gradient, or a blurred photo). | planned |
| F27 | Text and titles | B · P2 | Longer text. | planned |
| F28 | Text and titles | B · P2 | Option to turn off the automatic darkening gradient that every photo caption gets. | planned |
| F29 | Text and titles | I · P2 | Title templates or packs (intro, chapter, birthday, memorial, holiday). | planned |
| F30 | Text and titles | I · P2 | Subtitle styling (size, position, background). | planned |
| F31 | Text and titles | I · P3 | Offline automatic captions (local Whisper). | planned |
| F32 | Audio | B · P1 | A small bundled royalty-free music and sound-effects library. | planned |
| F33 | Audio | B · P1 | Sounds visible on the storyboard, with waveforms. | planned |
| F34 | Audio | B · P1 | "Fit photos to music length" / beat sync. | planned |
| F35 | Audio | B · P2 | Fade in and out on a video clip's own audio. | planned |
| F36 | Audio | B · P2 | Volume boost above 100%. | planned |
| F37 | Audio | I · P2 | Noise reduction for narration and clips. | planned |
| F38 | Audio | I · P2 | Normalise or match loudness across clips. | planned |
| F39 | Audio | I · P3 | Audio-only export (for example, the narration on its own). | planned |
| F40 | Audio | I · P3 | Remove the duplicate music systems. | proven: canonical placed sounds; CI 43996516140 |
| F41 | Overlays, layers and effects | B · P2 | Stickers, emoji, arrows and shapes. | planned |
| F42 | Overlays, layers and effects | B · P2 | Picture-in-picture, or one overlay layer for an image, logo or video on top. | planned |
| F43 | Overlays, layers and effects | I · P2 | Split screen / collage ("then and now"). | planned |
| F44 | Overlays, layers and effects | I · P3 | Green screen. | planned |
| F45 | Overlays, layers and effects | I · P3 | Simple start-and-end keyframes for position, zoom and opacity. | planned |
| F46 | Overlays, layers and effects | I · P3 | Looks or LUT import. | planned |
| F47 | Automation and templates | B · P1 | Auto-slideshow from a folder or selection. | planned |
| F48 | Automation and templates | B · P2 | Themes that set transitions, title style, filter and music together (holiday, birthday, memorial, wedding). | planned |
| F49 | Automation and templates | I · P3 | Project templates ("start from a birthday film"). | planned |
| F50 | Editing workflow | B · P1 | Insert where I am. | planned |
| F51 | Editing workflow | B · P1 | Multi-select (Shift- or Ctrl-click) with bulk delete, move, duration, transition and fit. | planned |
| F52 | Editing workflow | B · P1 | Standard shortcuts. | planned |
| F53 | Editing workflow | B · P2 | Right-click context menus on scenes and library items. | planned |
| F54 | Editing workflow | B · P2 | A timeline view option with a time ruler, zoom and proportional scene widths. | planned |
| F55 | Editing workflow | I · P2 | Copy and paste scene settings (style, transition, filter) to other scenes. | planned |
| F56 | Editing workflow | I · P3 | Markers / chapters, and grouping scenes into sections. | planned |
| F57 | Editing workflow | I · P3 | Proxy or optimised media for smooth 4K preview. | planned |
| F58 | Media library | B · P1 | Remove media from a project. | planned |
| F59 | Media library | B · P1 | Import legacy video: WMV, AVI, MKV, MTS/M2TS (AVCHD), 3GP, VOB. | planned |
| F60 | Media library | B · P2 | GIF, TIFF and SVG images. | planned |
| F61 | Media library | B · P2 | Replace media (swap a photo, keep its timing and caption) and relink a missing original. | planned |
| F62 | Media library | B · P2 | Library sorting (name, date, type) and used/unused markers. | planned |
| F63 | Media library | I · P3 | Folder import. | planned |
| F64 | Media library | I · P3 | Webcam and screen recording. | planned |
| F65 | Export | B · P2 | 4K export. | planned |
| F66 | Export | B · P2 | Frame-rate choice (24/25/30/60), or "match source". | planned |
| F67 | Export | B · P2 | Export a selection or range, and a sample around the playhead. | planned |
| F68 | Export | B · P2 | Hardware-accelerated and multi-threaded export. | planned |
| F69 | Export | I · P2 | GIF export. | planned |
| F70 | Export | I · P2 | Save the current frame as an image. | planned |
| F71 | Export | I · P3 | More aspect ratios: 4:5 (Instagram feed), 4:3 (old footage), 21:9 / 2.35:1 (ffDiaporama has it). | planned |
| F72 | Export | I · P3 | A custom quality slider, and named destination presets (YouTube, Instagram, WhatsApp, email). | planned |
| F73 | Export | I · P3 | Export in the background, so you can keep editing, plus an export queue. | planned |
| F74 | Projects and app | B · P1 | Delete, rename and duplicate ("Save as") films from My films. | planned |
| F75 | Projects and app | B · P1 | Double-click a `.corto` file to open it. | planned |
| F76 | Projects and app | B · P1 | Signed installers and an update channel. | planned |
| F77 | Projects and app | B · P1 | Raise the limits that real tributes hit. | model raised/tested (500-scene fixture); long export proof pending |
| F78 | Projects and app | B · P2 | Localisation. | planned |
| F79 | Projects and app | I · P2 | Version history (more than one recovery snapshot). | planned |
| F80 | Projects and app | I · P3 | Project-wide defaults: photo duration, transition, fit, title style and background. | planned |

## Findings to resolve
| ID | Finding | Status / evidence |
|---|---|---|
| B01 | GIF schema/import/picker agreement and deterministic animation | planned |
| B02 | Example does not retain an untouched empty draft | planned |
| B03 | Desktop import uses bundled FFmpeg for unsupported browser codecs | planned |
| B04 | Thread use follows a bounded machine/user budget | planned |
| B05 | One canonical placed-sound model and one editor path | resolved: one canonical sound model; CI 43996516140 |
| B06 | Long-caption export stages bounded raster data instead of an aggregate PNG cap | planned |

## External dependencies
Trusted Windows/macOS signing needs the publisher's certificates; the repository currently has no configured secrets. Configuration and update checking can be implemented autonomously; an OS-trusted identity cannot be invented or purchased under the existing authorisation. Optional model downloads must be explicit and source/licence-pinned; media never goes to a transcription or image service.
