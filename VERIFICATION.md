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
