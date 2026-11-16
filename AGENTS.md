# Corto

An account-free home video and slideshow maker for Windows, macOS, Linux and the web. Read PRODUCT.md, docs/adr/, ARCHITECTURE.md and TESTING.md before changing boundaries.

## Engineering
- Use descriptive names, strict TypeScript and small single-purpose functions.
- Domain logic is pure and framework-independent. Platform effects are injected through typed adapters.
- Extract business limits and repeated values into named constants. Document public contracts and why complex behaviour exists.
- State time/space complexity above genuinely algorithmic code; do not annotate trivial handlers.
- Handle malformed projects, missing media, cancelled dialogs, failed writes and cancelled exports explicitly.
- Keep files focused; no god components or arbitrary renderer filesystem/process access.
- Before code, state the plan; after code, report meaningful test cases and material limitations.

<!-- keel:start -->
## Keel
This repository uses `electron-web`; `keel.json` lists commands by test level.
- A tested claim names level, platform and run in append-only VERIFICATION.md.
- New tests prove they can fail. Baselines for pixels come from hosted runners.
- Flaky tests are quarantined with an issue; retries are allowed only once at L6/L7.
- UI reaches the platform only through the typed adapter. Validate the IPC boundary.
- Never silently migrate a future project schema or discard original media.
- Solo role: one implementation branch; no parallel ownership map.

## Layout
`contracts/`: shared schemas; `src/domain/`: editing model; `src/platform/`: adapters;
`src/components/`, `src/preview/`: editor; `electron/`: native I/O and export;
`tests/`: all levels; `.github/workflows/`: runner proof; `brand/`: original supplied assets.

## Commands
`npm run typecheck`, `npm run test:unit`, `npm run test:integration`,
`npm run test:ui`, `npm run build`, `npm run test:e2e`, `npm run package`.
`npm run triage -- <run-id>` provides the CI digest.
<!-- keel:end -->
