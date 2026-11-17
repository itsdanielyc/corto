<!-- keel:start -->
<p align="left"><img src="brand/corto-brand-assets/logo/svg/corto-lockup-black.svg" width="180" alt="Corto by miille"></p>

# Small films. Lasting memories.

Corto is a home video and slideshow maker for **Windows, macOS, Linux and the web**. Turn photos, short clips, music and a few words into a film worth keeping. No account, media upload, OneDrive requirement, subscription or watermark.

[Open the web app](https://itsdanielyc.github.io/corto/) � [Desktop previews](https://github.com/itsdanielyc/corto/releases) � [Installation guide](docs/installing.md)

![The Corto editor with its bundled example film](docs/images/editor.png)

## Make a little movie

1. Import photos, clips or music. Visual media goes straight into the storyboard.
2. Reorder scenes, trim clips, split or duplicate moments, and undo freely.
3. Add titles and timed subtitles. Place songs, record narration and choose fades or reduced music under clip sound.
4. Export in six aspect ratios with sharing presets or custom settings; try a five-second sample at the playhead first.

Create an editable slideshow from a folder or selection, fit it to music, or start with a birthday, holiday, wedding or memorial template. Photo motion, focal crop, colour, transitions, timed text, credits, overlays and a proportional timeline remain individually editable.

Desktop builds export local MP4, GIF, M4A and WAV using bundled, checksum-verified FFmpeg. Browser export uses the bundled local WebAssembly encoder with deterministic frame timing. Browser jobs have a 256 MB per-source and 512 MB working-file budget; large movies can transfer to desktop as portable projects. Export jobs keep their own project snapshots while you continue editing.

## Your projects stay with you

The editor autosaves named films on this device. **My films** supports rename, duplicate and delete, and can restore one of the last 30 metadata versions as a separate film. **Save portable copy** writes a self-contained `.corto` project with its original media, so it can move between computers and operating systems without relinking files. Keep portable copies of projects you want to preserve, especially when using browser storage.

The application contains no accounts, analytics, remote fonts or media upload service. The example and its credited photos/music are bundled locally. The production web shell can cache itself for offline use after the first successful load.

## Preview scope

- Native Windows x64, Apple Silicon and Intel Mac, Linux x64; responsive browser editor.
- JPG, PNG, WebP, BMP, HEIC/HEIF, GIF, TIFF and self-contained SVG; local conversion for legacy WMV/AVI/MKV/AVCHD/3GP/VOB and phone footage; MP3, WAV, M4A, AAC, FLAC and Ogg audio. Original bytes stay intact.
- Up to three hours, 1,000 scenes, 2,500 assets and 64 GB per project; 8 GB per asset. Desktop output includes 4K and 24/25/30/60 fps or source matching.
- Local Whisper captions and photo background removal download pinned model data only after an explicit request. Cached models work offline; media is never uploaded. The background-removal copy is bounded to 4K.
- A single storyboard with timed text/overlays and placed sound lanes, a bundled original CC0 music/SFX pack, English/Spanish UI, project defaults and opt-in release checking. Automatic installation of updates, general RAW/professional HDR editing and native mobile packages remain outside this preview.
- Desktop installers are **unsigned**. Read the [OS installation notes](docs/installing.md).

## Build and contribute

Use Node.js 24 and npm. Dependency installation verifies the native media engine against the committed upstream SHA-256 before executing it.

```sh
npm run setup               # npm ci without unnecessary Node/CUDA inference binaries
npx playwright install chromium
node node_modules/electron/install.js
npm run dev                 # desktop editor
npm run dev:web             # real browser editor
npm run build               # native application
npm run build:web           # static web app + offline cache
npm run package             # installer for the current OS
```

```sh
npm run typecheck
npm run test:unit
npm run test:integration     # real files + actual encoded movies
npm run test:ui              # browser journeys, accessibility and visuals
npm run test:e2e             # built native app, including a full editing/export journey
npm run test:web             # production build offline check, after build:web
```

Read [AGENTS.md](AGENTS.md), [architecture](ARCHITECTURE.md), [test strategy](TESTING.md), [verification ledger](VERIFICATION.md) and [project format](docs/project-format.md). Every support claim needs a level, platform and named run. Hosted runners capture pixel baselines; the installer gate blocks premature releases.

Application code is MIT-licensed. FFmpeg and other dependencies retain their own licences; see [third-party notices](THIRD_PARTY_NOTICES.md) and [example credits](public/demo/CREDITS.md). Corto/miille brand assets do not grant trademark rights.
<!-- keel:end -->

<details><summary>Original Keel scaffold provenance</summary>

# Corto

Generated by Keel from the `electron-web` template. Start with AGENTS.md.

## Commands

```bash
npm install
npm run test:unit
npm run test:ui        # Playwright, chromium, against the labelled mock
npm run build          # main, preload and renderer into out/ for the real-shell suite
npm run test:e2e       # Playwright's Electron launcher against the built app
```

</details>
