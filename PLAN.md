on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502 |on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502 |on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502 |on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502 |on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502 |<!-- keel:start -->
# Plan

| # | Slice | Done when | Levels | Status |
|---|---|---|---|---|
| 0 | Proven Electron scaffold | Tier 1 CI and installers green; runner-captured snapshots reviewed; ledger rows | L0-L7 | done; readiness/PID probe and 30 AppImage launches verified |
| 1 | Project contract and editing model | Invalid inputs rejected; timeline/trim/split/reorder/undo tests seen red then green | L1/L2 | done; CI 43788513056 |
| 2 | Local workspace and portable projects | Real I/O round trips; native save/reopen through built app | L2/L3/L6 | done for backend; CI 43790072321; user journey tested locally windows-x64 |
| 3 | Editor and actual preview | Import, edit, titles, sound, playback, aspect ratio and keyboard journeys; screenshots reviewed | L4/L5/L6 | done; CI 43808645430; pixels 43808009004 reviewed |
| 4 | Movie export | Native MP4 playable; timing, sound, cancellation and destination proven; browser export capability handled honestly | L1/L3/L4/L6 | done for native MP4 and supported browser MP4; experimental WebM deferred in ADR 004 / issue 8 |
| 5 | Distribution | All critical journeys and installers green for release commit; signed status explicit; packages and web build published | L0-L7 | done; v0.1.0, release 43810281678 and Pages 43810223347; unsigned preview |
| 6 | Product-only verification and maintainability | Controller/dialog/shortcut separation preserves behaviour; sample greeting coverage replaced by real project journeys | L0-L6 | done; CI 43808718412 |

## Rulings
- Full autonomy in the user's request overrides phase approval pauses and authorises this new public repository, pushes and delivery. No existing shared repository is modified.
- Repo: `itsdanielyc/corto`, because exact `miille` was not found; `miillehq` is not silently substituted.
- Desktop first, shared web editor; native mobile packages are outside the specified three-system launch.
- Monochrome brand, a restrained editorial interface and original supplied marks. No design-option approval gate is introduced for ordinary implementation.
- Use the proven `electron-web` template before feature code. Initial example greeting is retired in a later slice after replacement journeys prove equivalent platform coverage.
- Native export is local and bundled; no internet connection or external FFmpeg installation is required at runtime.
- Portable copies stream original bytes after a bounded manifest instead of recompressing them in ZIP. This bounds memory independently of project size and removes archive path extraction.
- The complete editor and rendering are one integration PR: source-audio, title rasterization, persistence and preview must meet in the same real user journey. Lower-level contracts and native storage landed first.
- Preview installers are unsigned unless pre-existing authorised credentials are available. No certificates, paid services or external messages are purchased/sent.

## Test surface
- Corrupt/newer project manifests, missing media, quota exhaustion and malformed portable archives.
- First/last/short scenes, repeated assets, exact trim boundaries and undo after split/reorder.
- Video/music mixing, silent movies, portrait/square exports, cancellation and export failure cleanup.

## v0.1.1 authorised scope
The user selected phone compatibility, project home/recovery, sound/narration, timed subtitles and sharing presets, and explicitly excluded automatic slideshows and photo-presentation changes. Role: solo. Framework and platform tiers stay unchanged.

| # | Slice | Done when | Levels | Status |
|---|---|---|---|---|
| 7 | Versioned media/editing contracts | v1 opens losslessly as v2; future schemas, invalid original links, audio bounds and overlapping subtitles fail visibly | L1/L2 | done; contract CI 43840996126, PR 10 |
| 8 | Project home and recovery | Named projects survive switching/restart; recovery makes a separate copy; portable imports never replace another film | L2/L3/L4/L6 | done; CI 43845836514 |
| 9 | Phone media | Real HEIC and HEVC fixtures import locally; compatible copies preview/export; immutable originals survive portable round trips | L1/L3/L4/L6 | done; CI 43845836514; offline web and portable-byte proof |
| 10 | Sound and narration | Trim/place/fade sequential songs and voiceovers; recording permissions/cancellation handled; ducking and encoded output proven | L1/L3/L4/L6 | done; CI 43845836514 including Intel FFmpeg 8 |
| 11 | Timed subtitles | Manual/SRT cues edit and round-trip; same cue timing appears in preview and actual MP4 | L1/L3/L4/L6 | done; CI 43845836514 |
| 12 | Sharing and v0.1.1 | TV/phone/small-file presets, approximate size and five-second sample work; fresh OS CI and installer gates precede tag | L1/L3-L7 | done; v0.1.1, CI 43852206059, pre-tag installers 43852206002, release/published-asset checks 43853081632, Pages 43852870771 |

Rulings: use explicit schema v2 migration for known v1 only; never mutate originals. Compatible phone copies are ordinary local assets linked to their archived originals, so existing portable streaming remains sufficient. Ducking lowers music under audible source clips and narration, with that exact UI wording; it is not a speech recogniser. Timed subtitles/SRT ship now; optional offline automatic transcription remains a later measured enhancement from the brainstorm. No 4K, signing credentials or automatic-update service is introduced by this patch release. Existing unsigned-preview disclosure and browser recording capability limits remain explicit.

## Creator tools (2026-11-17)
Scope: all numbered software capabilities and six findings in the user's Downloads audit, traced in `docs/FEATURES.md`; slideshow/photo presentation are now authorised. Solo implementation on `feat/creator-tools`; existing desktop/web framework and platform tiers stay unchanged.

| # | Slice | Done when | Levels | Status |
|---|---|---|---|---|
| 13 | Versioned creator contracts | Known v1/v2 projects migrate without losing scenes/media/audio; future schemas and malformed effects rejected; canonical sound model | L1/L2 | done; CI 43996516140, PR 13 |
| 14 | Shared composition/export foundation | Photo geometry, colour, layered text and overlapping transitions agree in browser canvas and independently decoded native frames; raster staging is bounded | L1/L3/L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 15 | Photo life and transitions | Motion, rotation/flips, focal crop, blur fill, adjustments, defaults/bulk edits and transition presets work in preview and movies | L1/L3-L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 16 | Workflow, library and project tools | Multi-select/clipboard/shortcuts, visual trim/timeline, insertion, media replace/remove/relink, folders, project actions/history and file-open paths pass journeys | L1-L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 17 | Text and credits | Multiple timed styled/animated items, long text/credits, backgrounds/templates and subtitle styling survive save/export | L1/L3-L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 18 | Media operations and capture | Legacy formats/images, speed/pitch, audio detach, freeze/frame save, reverse/stabilise/detection, proxies, webcam/screen capture perform real operations | L1/L3/L4/L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 19 | Sound tools and pack | Bundled original CC0 tracks/SFX, waveforms, fit/beat tools, clip fades/boost, noise/loudness and audio-only output proven | L1/L3-L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 20 | Slideshow/themes/templates | Folder/selection drafts with explicit date fallback, soundtrack fitting and editable themes; no existing film replaced silently | L1/L4/L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 21 | Overlays and looks | Shapes/stickers, image/video PiP, collage, chroma, start/end animation, LUTs and local photo cut-out render correctly | L1/L3-L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 22 | Export reach and background jobs | 4K/fps/ranges/GIF/audio/destination controls, capability-probed encoders, thread budgets, immutable background jobs and queue | L1/L3/L4/L6 | done; CI 44028155512; final installer gate recorded in ledger |
| 23 | Optional local models | Actual local caption/subject models operate on fixtures; downloads explicit, media never uploaded; missing models/cancellation recover | L1/L3/L4/L6 | done; four-target matrix 44024156161 and CI 44028155512 |
| 24 | Distribution and language | File associations, update check, language choice and credential-gated signing configured; actual signing status reported | L1/L3/L4/L6/L7 | done; CI 44028155512; final installer gate recorded in ledger |
| 25 | Release proof | Feature traceability complete, all declared OS checks/screenshots/installers green before tag; published bundles smoke-tested | L0-L7 | done; v0.1.2, pre-tag CI 44028786024 / installers 44028786011, release + published installs 44029731824, Pages 44030346040 and real public slideshow/offline proof |

Rulings: preserve original supplied brand and a simple editor; no unrelated redesign. Treat the audit's competitor claims as supplied research, not validated user demand. External signing identity is not fabricated. Hardware/model-dependent features report actual capabilities and have working software/local paths. Derivative media and queued exports use immutable snapshots and bounded workers/processes. All new tests are observed red; no skipped or placeholder feature may be called implemented.
Ruling: publish the web editor from verified release tags, not unreleased main commits. Schema-v3 development must not make the public web writer incompatible with the currently downloadable v0.1.1 desktop reader. Manual deployments still require a real published version and matching commit; automatic reruns cannot roll back a newer release.

## v0.1.2 bug sweep fixes
Source: the v0.1.2 bug sweep (17 Nov 2026). Role: solo, one branch per batch.

| # | Slice | Done when | Levels | Status |
|---|---|---|---|---|
| 26 | Export correctness | Fade-through-black keeps neutral colour; ranges starting inside a transition keep audio and mix music; animated layers neither smear nor clip; preview slide/push/zoom/blur match export, each with a test seen red first | L1/L3/L4/L6 | done on branch fix/export-correctness; CI 44093131135 green on all four desktop targets; not merged |

Ruling: the preview follows FFmpeg `xfade` for slide, push, zoom and blur rather than export following the preview, because the export is what people keep and the bundled native (6.1) and web (5.1) FFmpeg builds lack cover-style transitions. Cost if wrong: four preview animations change again.
Ruling: the crossfade audio uses two streaming linear fades mixed together instead of `acrossfade`, which buffers its whole output until both inputs end. Same curve; cost if wrong: a level difference in crossfades, covered by the existing dissolve and audio-output tests.

## Redesign: a light table and a screen (2026-11-20)
Source: the approved mockups recorded in DESIGN.md. The user asked for readable text sizes, no reassurance subtext, a separate design branch and a PR. Role: solo, branch `design/redesign`. Framework, platforms, project schema and export paths are unchanged.

| # | Slice | Done when | Levels | Status |
|---|---|---|---|---|
| 27 | Design system and shell | Tokens (light, dark, system), Inter, 12px text floor, title bar, library tabs, dark stage, mark play/pause, restyled controls; reassurance copy removed | L0/L4/L5 | on branch design/redesign; reviewed; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44809610640 on 57ddbdc |
| 28 | Contextual inspector | Scene tools live in the inspector (Picture/Clip/Card, Text, Overlays, Timing); film settings, sound and subtitles open there; no Scene tools modal | L4 | on branch design/redesign; reviewed; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44809610640 on 57ddbdc |
| 29 | Reel and seams | Transition picker at every seam; storyboard/timeline switch in the reel; sound lane restyled | L4 | on branch design/redesign; reviewed; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44809610640 on 57ddbdc |
| 30 | On the picture | Text items drag on the preview; start and end framing set on the picture | L1/L4 | on branch design/redesign; reviewed; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44809610640 on 57ddbdc |
| 31 | Start and finish | Films home view, first launch with drop count, slideshow steps, export sheet with progress in the title bar and a premiere, command palette | L4/L6 | on branch design/redesign; reviewed; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44809610640 on 57ddbdc |
| 32 | Every platform | Phone layout with bottom tabs and sheets; macOS and Windows title bars; theme setting | L4/L5/L6 | on branch design/redesign; reviewed; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44809610640 on 57ddbdc |
| 33 | Proof | New ARIA/geometry/pixel baselines from runners, CI on every target, ledger rows, PR | L0-L6 | pixel baselines from runners (snapshots 44808781291, looked at), CI on every target (44809610640, then 44811075320 on ca4fc78), ledger rows written, PR #22 reviewed and amended; not merged. Open: a look at the macOS traffic lights, and the Linux first-launch flake (the window is still hidden five seconds after the page is ready; passes on the one L6 retry) |

Ruling: Linux keeps the system window frame instead of a drawn header bar — client-side decorations differ by compositor and cannot be checked from a Windows machine. Cost if wrong: Linux looks less integrated than macOS and Windows.
Ruling: the theme preference is stored per device in local storage, not in the project or the preferences contract — it is presentation only. Cost if wrong: the choice does not travel with a portable copy, which it should not anyway.

### Review of PR #22 (2026-11-20, reviewer pass on slices 27–33)
Findings and fixes are in VERIFICATION.md under the same date. Decisions taken while reviewing:

Ruling: the contract additions (`setNativeTheme`, `windowFrame`, `isThemeChoice`, `windowFrameFor`) stay in this PR instead of a contract PR of their own — one role, one branch, additive, and the only consumers are in the same change. Cost if wrong: none until a second role shares the repository.
Ruling: the narration tests wait eight to ten seconds for "Recording · 1s" — the recorder now counts down three seconds on purpose, and the tests assert the countdown first. This is a product delay, not a widened timeout for a flaky test. Cost if wrong: a slower failure by a few seconds.
Ruling: the appearance storage keeps the author's per-device ruling but moves from `src/components` to `src/platform/appearance.ts`, because components reach platform effects only through the platform boundary. Cost if wrong: one import path.
Ruling: left for their own slices because main behaves the same — five English strings without Spanish (`Slideshow soundtrack`, `No music`, `Timeline ruler`, `Marker`, the template hint) and a typed duration that is not clamped to its limits. Cost if wrong: they stay as they are on main a little longer.
Ruling: the finished-export notice still sits over the inspector heading for ten seconds (seen in the hosted Linux real-shell screenshot). It is dismissible and brief, so it is recorded as a design follow-up rather than changed in review. Cost if wrong: scene actions are covered for up to ten seconds after a background export.

### Independent review of PR #22 (2026-11-21)

The November 21 review resolved the open slice 33 checks. Both macOS window captures show the native controls, the Linux startup diagnostic passed 30 fresh launches, and the layout suite now measures phone sheets. The export notice has its own row. Run links and the additional editing regressions are recorded in the November 21 section of VERIFICATION.md.

## miille family: one design language with Onda and Plico (2026-11-22)
Source: the owner asked for Corto and Plico to feel like miille apps, with Onda as the reference and the miille, Onda, Plico and Corto brand kits as material, the UI first and then the flows. The shared contract is docs/design/miille.md; DESIGN.md records Corto's part. Role: solo, branch `design/miille-family`. Framework, platforms, project schema and export paths are unchanged.

| # | Slice | Done when | Levels | Status |
|---|---|---|---|---|
| 34 | Family tokens and controls | Tokens use the family names and values; Onda's type scale (13 px floor), buttons, switches, segmented controls, keycaps, menus, dialogs and palette | L0/L4/L5 | on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502; tier 3 baselines from snapshots 44978480145 |
| 35 | Desk and sheet | The library on the desk, the stage, inspector and reel on one sheet with Onda's inset corner; the stage as a dark card; the empty stage as the graphite tile; window chrome in the desk colour | L4/L5/L6 | on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502; tier 3 baselines from snapshots 44978480145 |
| 36 | Films and Settings as places | Films with ways to start on the desk; Settings as a page that saves as it changes (Ctrl or Cmd and comma); Back returns where it came from | L4 | on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502; tier 3 baselines from snapshots 44978480145 |
| 37 | Feedback that never moves the editor | Background exports as a status card; ink toasts bottom right; Undo for removed scenes tied to the removal; an untouched film claims nothing about saving | L4 | on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502; tier 3 baselines from snapshots 44978480145 |
| 38 | Flows without dead ends | New film and Open project act at once; untouched films stay out of Films; a slideshow from Films chooses its own photos; one clip volume control; managing a film from a menu on its poster | L4 | on branch design/miille-family; tested on linux-x64, windows-x64, macos-arm64 and macos-x64 (L0-L6), CI 44981376464 on dfe1502; tier 3 baselines from snapshots 44978480145 |
| 39 | Proof | Tier 3 baselines from the runners, CI on every target, ledger rows, PR | L0–L7 | baselines from runners (snapshots 44978480145, looked at); CI green on every target (44981376464 on dfe1502); ledger rows written; PR #23 open, independent review findings fixed; installers run on main |

Ruling: the token names follow the family (`--base`, `--panel`, `--fg`…) instead of Corto's old names — a person moving between the three repositories finds the same words. Cost if wrong: one mechanical rename, already done.
Ruling: the library stays on the desk rather than on a white panel — Films and Settings use the same column for their places, so the window keeps its shape as you move, as Onda's sidebar does. Cost if wrong: media tiles sit on grey instead of white.
Ruling: the library tabs keep the names Media, Music and Titles — renaming Titles to Text would put two tabs named Text on screen (the inspector's words tab), which is worse for people and for screen readers. Cost if wrong: the phone's Text tab and the library's Titles tab keep different names.
Ruling: removing a film from Films still asks first — it cannot be undone, which is the family's one reason to ask. Cost if wrong: one extra click for an irreversible action.

## Scaffold retirement mapping
- Sample greeting contract → versioned project and real/mock repository conformance.
- Greeting form/clear flow → editor import, edit, undo, portable save/open and error recovery.
- Native greeting IPC → real native persistence and complete import/trim/title/music/save/reopen/MP4 journey.
- Sample home pixels → reviewed editor structure/geometry and per-OS runner pixels.
<!-- keel:end -->
