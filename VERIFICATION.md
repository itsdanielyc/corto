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
