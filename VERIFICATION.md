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

## 2026-11-16: shipping boundary and product-only code

Experimental WebM capture remains unverified and is disabled in production (ADR 004, issue #8). The desktop export path is native MP4 on all declared OSes; browser MP4 is offered only when available. Browser editing/offline persistence and portable project transfer remain supported. Historical WebM successes above do not override the observed Linux truncated-video finding. Those tests and code remain in advisory coverage; no video/duration/audio assertion was weakened.

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 05:08 | L0/L1/L6 | Layout separated from controller/dialog/shortcut policy; unused greeting scaffold retired after replacement journeys existed | local windows-x64 | Strict typecheck and build exit 0; 19 product unit checks and five native-shell checks pass. The removed three unit checks and native greeting call covered only the scaffold; replacement mapping is in PLAN.md. Actual user editing/export coverage is retained. |

## 2026-11-16: release-candidate evidence

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 05:15 | L0-L6 | Shipping editor, real file/movie integration, offline browser persistence, capability handling, accessibility, visual baselines and full native user journey pass | windows-x64, macos-arm64, linux-x64; macos-x64 L6 | [CI 43808645430](https://github.com/itsdanielyc/corto/actions/runs/43808645430), PR #6. Browser WebM is explicitly advisory; shipping scope is ADR 004. |
| 2026-11-16 05:16 | L0-L6 | Product-only code and refactor preserve behaviour and reviewed per-OS pixels | windows-x64, macos-arm64, linux-x64; macos-x64 L6 | [CI 43808718412](https://github.com/itsdanielyc/corto/actions/runs/43808718412), PR #9. |
| 2026-11-16 05:20 | L0-L6 / workflow validation | Distribution source checks pass and release/Pages YAML passes actionlint | windows-x64, macos-arm64, linux-x64; macos-x64 L6 | [CI 43808980442](https://github.com/itsdanielyc/corto/actions/runs/43808980442), PR #7; local `actionlint -shellcheck= -pyflakes=` exit 0. Gate script was observed red on an unproven branch SHA. |
| 2026-11-16 05:20 | L7 | Shipping native editor and bundled MP4 encoder install, launch and uninstall successfully | windows-x64, macos-arm64, macos-x64, linux-x64 (DEB/AppImage) | [Main installers 43809273343](https://github.com/itsdanielyc/corto/actions/runs/43809273343). A new release-candidate metadata commit still requires its own exact-SHA installer gate before tagging. |
| 2026-11-16 05:11 | L5 reviewed | Editor PNG baselines captured on each OS and visually reviewed; ARIA/geometry shared | windows-x64, macos-arm64, linux-x64 | [Snapshots 43808009004](https://github.com/itsdanielyc/corto/actions/runs/43808009004), committed by the workflow and included in PR #6. |

Remaining: exact release-commit CI/installers, tag publication, public web deployment and published-asset smoke checks. Unsigned status, native mobile, HEIC/RAW/HDR, other architectures/distributions and experimental WebM remain explicitly outside verified preview scope.

## 2026-11-16: v0.1.0 published and verified

Release source is `9ed80a7df08a30e88b2da923fbeeef4aee0efc1f`, tagged `v0.1.0` only after its exact-SHA gate passed. Subsequent documentation-only commits do not change the released source.

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 05:26 | L0-L6 release source | Final main commit passes shipping product checks and reviewed visual comparisons | windows-x64, macos-arm64, linux-x64; macos-x64 L6 | [CI 43809764318](https://github.com/itsdanielyc/corto/actions/runs/43809764318). |
| 2026-11-16 05:26 | L7 pre-tag gate | Exact release source installs, loads the editor, encodes native MP4 and uninstalls | windows-x64, macos-arm64, macos-x64, linux-x64 DEB/AppImage | [Installers 43809764353](https://github.com/itsdanielyc/corto/actions/runs/43809764353). Gate script observed green before creating the annotated tag; the tag message records both runs. |
| 2026-11-16 05:33 | release / L7 published assets | Tagged bundles rebuilt, installed and published; fresh non-build runners download the release assets and repeat install/encoder/uninstall checks | windows-x64, macos-arm64, macos-x64, linux-x64 DEB/AppImage | [Release 43810281678](https://github.com/itsdanielyc/corto/actions/runs/43810281678), all jobs green; [v0.1.0 assets](https://github.com/itsdanielyc/corto/releases/tag/v0.1.0). Unsigned preview; SHA256SUMS and media-engine source information attached. |
| 2026-11-16 05:29 | public web | Production app deploys and runs from its public URL; example and portable project work with the real browser adapter | GitHub Pages; local verification on windows-x64 / Chromium | [Pages 43810223347](https://github.com/itsdanielyc/corto/actions/runs/43810223347); public Playwright check: adapter `web`, CORTO001 project signature, 2,327,177-byte portable copy, zero page errors and zero non-GET/HEAD network requests. Screenshot visually reviewed. |

Final known exclusions: experimental browser WebM capture (disabled, advisory issue #8), signing/notarization, native mobile packages, HEIC/RAW/HDR workflows, unsupported CPU architectures/distributions and manual screen-reader certification. Native MP4 on the declared desktop platforms is verified; browser MP4 is capability-dependent and other browsers transfer portable projects to desktop.

## v0.1.1 contract and storage preparation

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 09:33 | L1/L2 | Strict v1-to-v2 migration, new sound/subtitle validation and future rejection | local windows-x64 | `npm run test:unit -- tests/unit/essentials-contract.test.ts`, exit 0, 2 tests. Observed red first: expected schema 2, received 1; unknown audio/subtitle keys. |
| 2026-11-16 09:33 | L2/L3 | Multiple named films, independent recovery after catalogue corruption and immutable phone originals through portable files | local windows-x64 | `npm run test:integration -- tests/integration/storage.test.ts tests/integration/phone.test.ts`, exit 0, 9 tests. Reds: missing listProjects; malformed latest catalogue blocked healthy films; deliberate original-link removal produced expected original ID / received undefined. |

This is contract/backend preparation, not a v0.1.1 release claim. Editor controls, browser phone conversion, audio/subtitle rendering and sharing remain in progress. Hosted platform and installer proof for v0.1.1 is pending.

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 09:39 | L0-L6 contract/backend | Versioned seam and local catalogue/phone backend pass the shared OS checks before editor changes | windows-x64, macos-arm64, linux-x64; macos-x64 L6 | [CI 43840996126](https://github.com/itsdanielyc/corto/actions/runs/43840996126), 13 green jobs; merged as PR 10. |
| 2026-11-16 09:42 | L0-L5 | New project, phone, sound, recording, subtitle and sharing browser journeys; existing behaviour/accessibility and reviewed Windows baseline | local windows-x64 / Chromium | `npm run typecheck`, `npm run test:unit` (24), `npm run test:ui` (18 passed, 2 existing experimental WebM skips), exit 0. Deliberate UI path breaks made all six new journeys fail: missing project opener, 0 HEIC scenes, absent restored sound, missing estimate, absent recording and wrong permission error. |
| 2026-11-16 09:46 | L3/L6 | Native phone originals, placed/trimmed/looped sound, real microphone API narration, burned subtitle timing, music ducking and 5-second sample | local windows-x64 | `npm run build`, `npm run test:integration` (12), `npm run test:e2e` (6), exit 0. Actual MP4 dimensions/duration, subtitle pixels and independent 880 Hz levels asserted. Sound/subtitle panel screenshots inspected. Disabling subtitle burn made the new shell journey red (expected positive subtitle pixels, received 0). |
| 2026-11-16 09:47 | L4 production web | Phone conversion and portable originals work after a production offline reload | local windows-x64 / Chromium | `npm run build:web` and `npm run test:web`, exit 0, 2 journeys. Removing the cached FFmpeg WASM made the new offline journey fail: expected 2 scenes, received 1; restored for the final build. |

Negative unit proofs: disabled gain produced expected 0.25 / received 0; shifted cue times produced expected next caption / received previous caption; disabled sample trimming produced expected [4,1] / received [4,4]. Sequential-song preparation was also seen red before implementation (expected two source-bounded songs, received []). Source was restored after every deliberate break. Local logs remain under artifacts/negative. Hosted feature screenshots, full platform feature proof and v0.1.1 installer/release evidence remain pending.

| Date (UTC) | Level | Claim / finding | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 10:02 | L0-L6 findings | First hosted feature run passed native journeys on Tier 1; Linux browser fallback contrast and Intel Mac sound mixing blocked release | windows-x64, macos-arm64, linux-x64; macos-x64 | [CI 43844422532](https://github.com/itsdanielyc/corto/actions/runs/43844422532), 11 green jobs and two findings. Linux `.inline-error` failed WCAG contrast; Intel exports remained at audio mixing in both runs. Snapshot capture 43844421138 therefore did not publish baselines. No tag was created. |
| 2026-11-16 10:04 | L4 regression | Unsupported-browser export state has readable contrast and truthful format text; unknown OS MIME still imports a real phone video offline | local windows-x64 / Chromium | Forced unsupported-recorder test first failed `color-contrast`, then passed after the colour/status fix. Production phone test first rejected `application/octet-stream`, then passed with extension-based archive MIME. `npm run test:web`, 2 passed. |

Intel diagnosis: music and narration inputs now have explicit finite demuxer durations as well as trim filters; looping sources cannot keep a mixer input open indefinitely. Real-I/O integration now includes macos-15-intel to exercise its distinct FFmpeg 8 engine. Local integration remains green (12 tests, 10:05 UTC); hosted Intel confirmation is pending, without relaxing any assertions or increasing retries/timeouts.

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 10:11 | L0-L6 | Selected v0.1.1 features pass every declared platform, including the distinct Intel Mac media engine | windows-x64, macos-arm64, linux-x64; macos-x64 L3/L6 | [CI 43845836514](https://github.com/itsdanielyc/corto/actions/runs/43845836514), all 14 jobs green. Finite audio input bounds resolved the Intel mixing stall with unchanged assertions. |
| 2026-11-16 10:12 | L5 visual review | Current Windows, Linux and macOS editor pixels, shared ARIA and native sound/subtitle panels reviewed | three OS families; native x64/arm64 captures | [Snapshots 43845823778](https://github.com/itsdanielyc/corto/actions/runs/43845823778) green. Each OS's own PNG was inspected and copied unchanged. The old artifact merger could overwrite Linux/Mac captures with other runners' stale files; selective staging now uploads only the runner's PNGs, with Linux owning shared files. Local staging contains only the Windows PNG. |

All selected editing slices now have hosted feature proof. Installer proof for the final merged release commit remains pending; no v0.1.1 tag exists yet.

Repeated-run finding: CI 43846937476 passed Intel real-I/O integration but the five-second native sample UI assertion failed twice at the audio-mix phase, despite the application code being unchanged from green CI 43845836514. The journey is quarantined on Intel only under issue #12 (https://github.com/itsdanielyc/corto/issues/12); it remains required on Tier 1. A manual 30-attempt Intel diagnostic preserves the original five-second assertion, logs later terminal state without turning failures into passes, and uses zero diagnostic retries. The release stays held until the cause is established, the journey is restored and 20 clean repeated runs are recorded. Existing policy remains one retry at L6/L7 only and none below.

| Date (UTC) | Level | Claim / finding | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 10:32 | L6 repeated diagnosis | 30/30 native samples completed; the generic five-second UI wait caused 5/30 false failures | macos-x64 | [Diagnostic 43848223003](https://github.com/itsdanielyc/corto/actions/runs/43848223003): completion 3,004–6,481 ms; every late case eventually reached success with no encoder error. This qualifies the earlier 'stall' finding: finite input bounds remain useful, but the remaining failure was waiting for a UI heading before the real CPU-bound job completed. |
| 2026-11-16 10:35 | L6 regression | Native journeys await the actual backend completion event, then retain every existing UI/pixel/audio/duration assertion | local windows-x64 | Existing overall 60-second test budget and five-second presentation assertion are unchanged. Full native suite: 6 passed. Fresh deliberate blank subtitle and title layers each made their corresponding journey fail (expected positive pixels, received 0); sources restored and positive journeys rerun. |

The completion watcher also rejects real export error alerts and disposes its subscription/observer. No test timeout or retry count was increased. Intel quarantine remains until the 20-repeat verification finishes and is then removed; release gates remain held.

| Date (UTC) | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-16 10:46 | L6 repeated verification | The corrected native journey passes 20 consecutive attempts, with actual encoded movie checks and zero retries | macos-x64 | [Verification 43850799759](https://github.com/itsdanielyc/corto/actions/runs/43850799759): 20 passed in 5.9 minutes, export completion 2,893–7,073 ms. All original subtitle/audio/duration/dimension assertions remain. The Intel-only skip is removed and issue #12 is resolved. |
| 2026-11-16 10:18 | L5 harness | Per-runner snapshot staging works on all three hosted OS families | windows-x64, macos-arm64, linux-x64 | [Snapshots 43847067976](https://github.com/itsdanielyc/corto/actions/runs/43847067976), all capture and merge jobs green; no stale cross-OS image overwrite. |

There are no quarantined v0.1.1 feature journeys. Ruling: the application code already has green cross-platform feature proof, and the only final edit removes the Intel skip after its 20 clean real-shell repetitions. Merge the release candidate normally, then require full CI and installer proof on the exact merged main commit before tagging. Installer/release status is still pending; no release claim is made by this row.
