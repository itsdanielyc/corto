<!-- keel:start -->
# Plan

| # | Slice | Done when | Levels | Status |
|---|---|---|---|---|
| 0 | Proven Electron scaffold | Tier 1 CI and installers green; runner-captured snapshots reviewed; ledger rows | L0-L7 | initial runs green; later AppImage liveness regression tracked |
| 1 | Project contract and editing model | Invalid inputs rejected; timeline/trim/split/reorder/undo tests seen red then green | L1/L2 | done; CI 43788513056 |
| 2 | Local workspace and portable projects | Real I/O round trips; native save/reopen through built app | L2/L3/L6 | done for backend; CI 43790072321; user journey tested locally windows-x64 |
| 3 | Editor and actual preview | Import, edit, titles, sound, playback, aspect ratio and keyboard journeys; screenshots reviewed | L4/L5/L6 | tested locally windows-x64; final CI and runner pixels pending |
| 4 | Movie export | Native MP4 and detected browser format playable; timing, sound, cancellation and destination proven | L1/L3/L4/L6 | tested locally windows-x64; final CI pending |
| 5 | Distribution | All critical journeys and installers green for release commit; signed status explicit; packages and web build published | L0-L7 | pending |

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
<!-- keel:end -->
