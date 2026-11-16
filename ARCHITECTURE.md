<!-- keel:start -->
# Architecture

## Boundaries
1. `contracts/`: versioned project schemas and the typed platform interface. No React, Electron or filesystem imports.
2. `src/domain/`: pure scene editing, validation, timing and history. Ordered scene arrays describe chronology; a keyed asset map gives constant-time media lookup.
3. `src/platform/`: browser persistence/import/export and a labelled test adapter. Only this boundary accesses the Electron bridge.
4. `src/components/` and `src/preview/`: accessible editor controls and canvas playback. UI calls domain functions and the platform interface.
5. `electron/`: validated IPC, native dialogs, atomic local storage and streaming FFmpeg export. It imports contracts and pure export planning, never React.
6. `tests/` and `scripts/`: behaviour, contract, I/O, browser, real-shell and installer evidence.

## The seam
The UI sees `CortoPlatform`, never `ipcRenderer`. Shared TypeScript contracts plus runtime schemas validate project boundaries and native export requests. Contract tests exercise persistence with both real file storage and the labelled mock. Production web is a real browser adapter, not the mock. The mock announces itself only in test mode.

## Data and state
- A versioned `Project` owns ordered scenes, media metadata, the legacy soundtrack, placed sound and timed subtitle cues.
- Scene IDs and asset IDs are generated opaque UUIDs. Edits preserve structural sharing; undo history is bounded.
- Source media stays immutable. Edits use durations, source offsets, captions, fitting and transitions.
- Browser media lives as Blobs in IndexedDB, separate from metadata. Desktop media lives in an application workspace addressed by validated opaque IDs.
- Autosave serialises writes and retains a recoverable last project. Explicit portable `.corto` containers include a bounded JSON manifest and streamed original media; no external paths are accepted. See docs/project-format.md.
- Schema v2 explicitly migrates the strict known v1 shape; unknown/future schemas fail visibly. Compatible phone copies link to immutable archived originals; both travel in portable projects (ADR 005).
- Local project catalogues keep distinct named films. Recovery opens a new identity; a corrupt catalogue entry remains visible while other films remain accessible. Desktop snapshots are independent files.

## Rendering
Preview uses one canvas composition surface and only the current media element; timeline boundaries are computed once per edit. Native export renders scenes sequentially to bounded temporary files, concatenates them and mixes music. A frame-compatible caption overlay is rasterised in the renderer so native/browser typography agrees. Temporary export outputs are cleaned on failure or cancellation; only a complete movie reaches the destination.

## Platform integration
Native file selection, save destination and reveal-in-folder are confined to Electron. Environment-controlled dialog presets are accepted only in automated-test mode. No arbitrary shell commands, arbitrary renderer paths or remote navigation are exposed.

## Deliberately simple
- A single linear storyboard instead of a general multitrack graph. Add tracks only if user jobs require overlapping clips.
- Placed music/narration is a bounded sound list with source offset, film start, duration, volume, fades and looping. The original simple soundtrack control remains compatible. Ducking uses source-sound-enabled video/narration intervals rather than speech recognition.
- Timed subtitles are plain non-overlapping cues. The same canvas text rendering serves preview/browser recording and native PNG subtitle frames; user text never enters a filter expression.
- HEIF decoding and browser HEVC conversion run in local workers. Native HEVC/HDR conversion streams through the bundled subprocess; no cloud converter exists. Web conversion is bounded to 256 MB; HEIF to 64 megapixels.
- TV/phone/small-file export presets share a bitrate budget and approximate file-size estimate. A five-second sample is a non-destructive view of the same project.
- Solo implementation; no shared-worktree ownership protocol is needed.
<!-- keel:end -->
