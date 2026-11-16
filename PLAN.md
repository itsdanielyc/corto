<!-- keel:start -->
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
| 8 | Project home and recovery | Named projects survive switching/restart; recovery makes a separate copy; portable imports never replace another film | L2/L3/L4/L6 | backend CI proven; editor tested locally windows-x64; hosted feature proof pending |
| 9 | Phone media | Real HEIC and HEVC fixtures import locally; compatible copies preview/export; immutable originals survive portable round trips | L1/L3/L4/L6 | native backend CI proven; browser/offline and UI tested locally windows-x64; hosted feature proof pending |
| 10 | Sound and narration | Trim/place/fade sequential songs and voiceovers; recording permissions/cancellation handled; ducking and encoded output proven | L1/L3/L4/L6 | tested locally windows-x64; hosted feature proof pending |
| 11 | Timed subtitles | Manual/SRT cues edit and round-trip; same cue timing appears in preview and actual MP4 | L1/L3/L4/L6 | tested locally windows-x64; hosted feature proof pending |
| 12 | Sharing and v0.1.1 | TV/phone/small-file presets, approximate size and five-second sample work; fresh OS CI and installer gates precede tag | L1/L3-L7 | version 0.1.1 prepared; release gates pending |

Rulings: use explicit schema v2 migration for known v1 only; never mutate originals. Compatible phone copies are ordinary local assets linked to their archived originals, so existing portable streaming remains sufficient. Ducking lowers music under audible source clips and narration, with that exact UI wording; it is not a speech recogniser. Timed subtitles/SRT ship now; optional offline automatic transcription remains a later measured enhancement from the brainstorm. No 4K, signing credentials or automatic-update service is introduced by this patch release. Existing unsigned-preview disclosure and browser recording capability limits remain explicit.

## Scaffold retirement mapping
- Sample greeting contract → versioned project and real/mock repository conformance.
- Greeting form/clear flow → editor import, edit, undo, portable save/open and error recovery.
- Native greeting IPC → real native persistence and complete import/trim/title/music/save/reopen/MP4 journey.
- Sample home pixels → reviewed editor structure/geometry and per-OS runner pixels.
<!-- keel:end -->
