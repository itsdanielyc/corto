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
- A versioned `Project` owns ordered scenes, media metadata, canonical placed sound and timed subtitle cues.
- Scene IDs and asset IDs are generated opaque UUIDs. Edits preserve structural sharing; undo history is bounded.
- Source media stays immutable. Edits use durations, source offsets, captions, fitting and transitions.
- Browser media lives as Blobs in IndexedDB, separate from metadata. Desktop media lives in an application workspace addressed by validated opaque IDs.
- Autosave serialises writes and retains a recoverable last project. Explicit portable `.corto` containers include a bounded JSON manifest and streamed original media; no external paths are accepted. See docs/project-format.md.
- Schema v3 explicitly migrates the strict known v1/v2 shapes; unknown/future schemas fail visibly. Compatible phone copies link to immutable archived originals; both travel in portable projects (ADRs 005–006).
- Local project catalogues keep distinct named films. Recovery opens a new identity; a corrupt catalogue entry remains visible while other films remain accessible. Desktop snapshots are independent files.
- Desktop metadata uses strict UTF-8. An unreadable or newer working copy stays intact while other films save to their own catalogue entries. Normal window or tab close asks before discarding edits that have no confirmed local or portable copy.

## Rendering
Preview uses one canvas composition surface and a bounded current/next media pool with independent clocks for repeated assets and overlays. Native and browser-WASM export consume the same pure frame/filter plans, render bounded scene/overlap segments, concatenate once and mix sound. Text is rasterised incrementally so typography agrees without aggregating every PNG in IPC. Temporary output is cleaned on failure/cancellation; only a complete movie reaches its destination.

## Platform integration
Native file selection, save destination and reveal-in-folder are confined to Electron. The window frame follows the OS (macOS traffic lights inset, Windows caption overlay, Linux system frame); the preload reports which from the mapping in `contracts/platform.ts` that the main process also uses, and the appearance choice reaches `nativeTheme` through one validated channel so native controls match the page. The choice itself is per-device browser storage behind `src/platform/appearance.ts`; components never touch storage. Environment-controlled dialog presets are accepted only in automated-test mode. No arbitrary shell commands, arbitrary renderer paths or remote navigation are exposed.

## Creator-tools evolution
- Shared schemas are split by responsibility (values, creative settings, project, platform). V3 migration normalises old music into placed sounds and adds explicit transform/text/overlay/output/default fields.
- Domain geometry, transitions, source-time mapping, selection/clipboard, templates and export segmentation are pure. Arrays retain chronology; ID maps/sets provide reference and selection lookup.
- One composition contract describes oriented/focal media, motion, colour, timed layers, transition overlap and sound. Preview/browser output and native command planning consume those same values.
- Native exports stage small raster layers incrementally and render bounded segments; do not collect every full-frame title in an IPC request or build an unbounded all-scenes filter graph.
- Effects/capture/model/proxy services live behind typed adapters. Native jobs own temporary paths and fixed subprocess arguments; browser effects use local workers. No renderer filesystem/process or remote-code primitive is added.
- Export queues own immutable project snapshots; editing never mutates an active job. Temporary outputs are atomic and cancelled jobs clean only their owned directories.
- Version/trash/preferences metadata is separate from immutable originals. Removing project references never silently deletes shared source files or another film's history.
- Optional models run in a worker using locally bundled ONNX/WASM code and explicitly downloaded, revision-pinned public model data. Speech uses short source windows; cut-outs retain their original photo. See ADR 008.

## Deliberately simple
- A single linear storyboard instead of a general multitrack graph. Add tracks only if user jobs require overlapping clips.
- Placed music/narration is a bounded sound list with source offset, film start, duration, volume, fades and looping. The original simple soundtrack control remains compatible. Ducking uses source-sound-enabled video/narration intervals rather than speech recognition.
- Timed subtitles are plain non-overlapping cues. The same canvas text rendering serves preview/browser recording and native PNG subtitle frames; user text never enters a filter expression.
- HEIF decoding and browser HEVC conversion run in local workers. Native HEVC/HDR conversion streams through the bundled subprocess; no cloud converter exists. Web conversion is bounded to 256 MB; HEIF to 64 megapixels.
- TV/phone/small-file export presets share a bitrate budget and approximate file-size estimate. A five-second sample is a non-destructive view of the same project.
- Solo implementation; no shared-worktree ownership protocol is needed.
<!-- keel:end -->
