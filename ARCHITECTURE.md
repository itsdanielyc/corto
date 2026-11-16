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
- A versioned `Project` owns ordered scenes, media metadata, a single soundtrack and output settings.
- Scene IDs and asset IDs are generated opaque UUIDs. Edits preserve structural sharing; undo history is bounded.
- Source media stays immutable. Edits use durations, source offsets, captions, fitting and transitions.
- Browser media lives as Blobs in IndexedDB, separate from metadata. Desktop media lives in an application workspace addressed by validated opaque IDs.
- Autosave serialises writes and retains a recoverable last project. Explicit portable `.corto` archives include the JSON manifest and original media; archive paths are validated before reading.
- Schema version 1 fails visibly for newer versions rather than silently discarding fields.

## Rendering
Preview uses one canvas composition surface and only the current media element; timeline boundaries are computed once per edit. Native export renders scenes sequentially to bounded temporary files, concatenates them and mixes music. A frame-compatible caption overlay is rasterised in the renderer so native/browser typography agrees. Temporary export outputs are cleaned on failure or cancellation; only a complete movie reaches the destination.

## Platform integration
Native file selection, save destination and reveal-in-folder are confined to Electron. Environment-controlled dialog presets are accepted only in automated-test mode. No arbitrary shell commands, arbitrary renderer paths or remote navigation are exposed.

## Deliberately simple
- A single linear storyboard instead of a general multitrack graph. Add tracks only if user jobs require overlapping clips.
- One soundtrack with loop/volume and native clip sound. Ducking, voiceover and wave editing wait for evidence of need.
- A single current project with explicit portable copies. A project dashboard can follow once library management becomes a real job.
- Solo implementation; no shared-worktree ownership protocol is needed.
<!-- keel:end -->
