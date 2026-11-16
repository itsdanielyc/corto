# Verification ledger

Append-only. Each row says what was proven, where, and by which run. "Built"
is never rounded up to "tested"; anything not listed here is unverified.

| Date | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|

## Unverified

- Everything: the scaffold has not yet run in CI for this project.

## 2026-11-16: scaffold and model (later rows supersede the initial state above)

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 01:43 | L0-L6 scaffold | Strict types, shared greeting contract, browser behaviour, reviewed runner pixel baselines and native shell round trip pass | windows-x64, macos-arm64, linux-x64, macos-x64 (L6) | [CI 43787603161](https://github.com/itsdanielyc/corto/actions/runs/43787603161); snapshots from [43786985790](https://github.com/itsdanielyc/corto/actions/runs/43786985790), reviewed in PR #1. |
| 2026-11-16 01:37 | L7 scaffold | Initial NSIS, DMG, DEB and AppImage round trips pass | windows-x64, macos-arm64, linux-x64 | [Installers 43786990576](https://github.com/itsdanielyc/corto/actions/runs/43786990576). A later AppImage liveness failure in 43787603169 remains under investigation; this row is historical evidence, not a release gate. |
| 2026-11-16 01:41 | L6 guard | Native response mutation is detected; restoration passes | local windows-x64 | `npm run build` + `npm run test:e2e`: red Expected main-process greeting, Received broken-process greeting; restored exit 0, 4 tests. |
| 2026-11-16 01:48 | L0/L1/L2 model | Project/schema relationships, immutable edits, timing, history and bounded container indexing pass | local windows-x64 | `npm run test:unit` exit 0, 17 tests; `npm run typecheck` exit 0. Tests written first; mutation run detected 13 broken assertions including wrong duration, swapped portrait dimensions, missing history and a second unsafe manifest read. Restored run green. |

### Outstanding after this slice
- AppImage's later intermittent liveness failure must be diagnosed before release.
- Model checks have not yet run on the remote slice commit.
- Editor, storage, real movie export and final installers are not yet implemented or verified.

## 2026-11-16: foundation progress

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 01:54 | L0-L6 | Model slice and platform contract pass hosted checks before merge | windows-x64, macos-arm64, linux-x64, macos-x64 (L6) | Model [43788513056](https://github.com/itsdanielyc/corto/actions/runs/43788513056), platform contract [43789070197](https://github.com/itsdanielyc/corto/actions/runs/43789070197); PRs #2 and #4. |
| 2026-11-16 01:58 | L7 | Installed renderer readiness and exact main-process PID pass; AppImage launches 30/30 | windows-x64, macos-arm64, linux-x64 | [43788627363](https://github.com/itsdanielyc/corto/actions/runs/43788627363); PR #3. Replaces the temporary-directory regex with an app-written readiness signal. |
| 2026-11-16 02:04 | L3/L6 foundation | File-backed contract, streamed portable save/import, preserved working copy on failure, serialized saves, native sandboxed IPC | local windows-x64 | `npm run test:integration` exit 0, 5 checks; build plus `npm run test:e2e` exit 0, 5 checks. The native storage test is boundary evidence; a user editing journey is still required. |

### Current gaps
- Browser persistence implementation is built; real browser journeys follow with the editor.
- Movie rendering, final UI, final installers and paid signing remain unverified.

## 2026-11-16: complete local editor and actual movies

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 02:16 | L0-L6 foundation | Native workspace and streaming portable project implementation green before merge | windows-x64, macos-arm64, linux-x64, macos-x64 (L6) | [CI 43790072321](https://github.com/itsdanielyc/corto/actions/runs/43790072321), PR #5. |
| 2026-11-16 03:19 | L0-L3 | Strict types, 21 unit/contract checks and 8 real-I/O/movie checks pass. MP4 checks decode frames, inspect dimensions/duration and correlate independent 440/880 Hz tones; cancellation preserves the destination and removes temporary files. | local windows-x64 | `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, exits 0. Native frame allocation tested over 300 quarter-second scenes. |
| 2026-11-16 03:19 | L4/L5 local | Import/edit/reorder/undo, title cards, persistence after reload, portable download/open, corruption recovery, browser movie recording and cancellation; reviewed desktop, mobile and export screenshots | local windows-x64 / Chromium | `npm run test:ui`: 13 passed, one not-yet-captured editor pixel baseline skipped. Structure/geometry are local; final per-OS PNGs still require the snapshots workflow. |
| 2026-11-16 03:19 | L4 accessibility | No detected WCAG A/AA violations in the tested editor/export states; narrow layout has no horizontal overflow; modal focus restores; Space operates actual preview | local windows-x64 / Chromium | `playwright test tests/ui/accessibility.spec.ts`, exit 0, 2 checks. Reds found and fixed low-contrast labels and focus returning to the body. This is automated evidence, not a screen-reader certification. |
| 2026-11-16 03:19 | L6 user journey | Import photo/video, trim source, add title/music, save portable, start new film, reopen and export an MP4 through actual controls and native dialogs' test presets | local windows-x64 | `npm run build` + `npm run test:e2e`, exit 0, 6 checks. Actual movie dimensions, duration, mixed tone frequencies and caption pixels inspected. Red caught a tainted native thumbnail canvas; anonymous CORS media requests fixed it. |
| 2026-11-16 03:19 | L4 production web | Real web adapter loads from a built production bundle, then reloads and builds the example entirely offline | local windows-x64 / Chromium | `npm run build:web` + `npm run test:web`, exit 0. Red caught cache misses caused by Vary: Origin on static module assets; invariant precached assets now ignore that header. |
| 2026-11-16 03:19 | build integrity | Downloaded native binary matches pinned upstream SHA-256 before execution; dependency audit has zero known findings | local windows-x64 | `npm install` postinstall, verified 04e1307997530f9c…; `npm audit` reports zero vulnerabilities after minimatch override. |

### Remaining release evidence
- Complete app CI, runner-captured editor pixel baselines and final packaged installers have not yet run for this commit.
- Unsigned build policy remains explicit; paid signing/notarization, native mobile and unsupported architectures remain outside this preview.

## 2026-11-16: cross-platform findings and corrected WebM seek metadata

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 03:43 | L7 | Complete packaged editor launches and its bundled native encoder produces MP4; uninstall round trips pass | windows-x64, macos-arm64, macos-x64, linux-x64 (DEB/AppImage) | [Installers 43799441008](https://github.com/itsdanielyc/corto/actions/runs/43799441008). Historical build evidence; the release commit still needs its own gate. |
| 2026-11-16 04:00 | L0-L4/L6 | Strict types, real file/movie integration, production web offline and complete native user journey pass | windows-x64, macos-arm64, linux-x64; macos-x64 (L6) | [CI 43801199633](https://github.com/itsdanielyc/corto/actions/runs/43801199633). Required UI jobs were red only for missing editor pixel baselines; the macOS snapshot run separately exposed a WebM seek-index defect. |
| 2026-11-16 04:22 | L4 media regression | Captured raw/incorrectly indexed recordings expose unsafe seek cues; only clusters beginning with a keyframe enter the final index | local windows-x64 / Chromium | `playwright test tests/ui/webm.spec.ts`: green after correction; deliberately using unfiltered cues reproduced FFmpeg fast-seek decoding errors. Source restored. |
| 2026-11-16 04:22 | L4 repeated codec | Shipping WebM fallback exports real frames, captions and both audio tones in 30 consecutive runs; default Full HD export also passes | local windows-x64 / Chromium | `playwright test tests/ui/export.spec.ts --grep 'webm fallback' --repeat-each=30 --workers=2`, exit 0, 30/30; normal output cases pass at 1080p and 720p. No retries used. |

The WebM defect was a metadata-index problem, not a justification to relax frame decoding checks. The streaming adapter retains original media bytes, filters interframe clusters out of seek cues, and runs off the UI thread. Remote repeated codec checks and final pixels remain pending.

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 04:33 | L4 browser timing | Delayed decoder startup does not extend the storyboard's recorded duration; prepared media, capture and scene timing share one epoch | local windows-x64 / Chromium | `playwright test tests/ui/export.spec.ts tests/ui/webm.spec.ts`, exit 0, five checks. Delaying play promises by 200 ms first produced 2.6 s and failed the unchanged <2.25 s assertion; priming while paused fixes it. Fast-seek caption and dual-tone checks remain required. |
