<!-- keel:start -->
# ADR 001: Electron and a shared browser editor
Status: accepted. Date: 2026-11-16.

## Context and decision
Procedure step 3 settles the choice: consistent browser media rendering and hosted-runner GUI automation are more valuable here than a smaller download. Use the proven Keel `electron-web` profile, TypeScript, React, Vite and a sandboxed preload. The same renderer builds as a static web application.

Use a typed platform adapter. Browser production storage is a real local implementation; the visibly labelled mock is only selected by the UI test configuration. Electron handles native dialogs, local persistence and a separately executed FFmpeg binary. No media upload service exists.

## Rejected options
- Tauri: smaller footprint, but system webviews introduce media codec and preview differences between OSes.
- Flutter/native toolkits: no shared DOM browser surface and a more costly automation seam.
- Browser-only: lacks reliable local MP4 export and desktop installation.

## Test consequences
- L0-L3: TypeScript, Vitest, shared schemas, real temporary storage and real native movie rendering.
- L4: Playwright browser UI tests against a visibly labelled mock built from the platform interface.
- L5: shared ARIA and geometry checks; per-OS pixel baselines captured by hosted runners.
- L6: Playwright Electron drives the built app through the sandboxed preload; native dialogs use a test-only preset path.
- L7 installer tests cover NSIS `.exe` on Windows, `.dmg` on macOS, `.deb` and `.AppImage` on Linux.
- Windows x64 GUI: `windows-latest` supports Playwright Electron.
- macOS arm64 GUI: `macos-latest` supports Playwright Electron.
- Linux x64 GUI: `ubuntu-latest` supports Playwright Electron under Xvfb.

## Packaging and security
electron-builder emits unsigned preview installers; no signing secrets are created. Native code is inaccessible to renderer scripts except through validated IPC. Navigation and new windows are blocked, and content security policy excludes remote code. Original supplied platform icons are reused.

Ruling: MIT application source with separately distributed FFmpeg notices, corresponding source links and license text; FFmpeg is a subprocess, not linked into the application. Cost if wrong: change the binary distribution before release.

References: [Electron testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/), [FFmpeg licensing](https://www.ffmpeg.org/legal.html), inspected 2026-11-16.
<!-- keel:end -->
