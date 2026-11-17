<!-- keel:start -->
# ADR 006: Versioned creator data and release-matched surfaces
Status: accepted. Date: 2026-11-17.

The user authorised the Downloads audit's feature backlog and explicitly reopened slideshow creation/photo presentation. Preserve the existing local editor and platform tiers.

- Schema v3 describes transforms/motion, adjustments, transition duration, timed text/layers, subtitle style, output/default settings, markers and optional source/proxy metadata. Validation rejects unknown fields/versions and checks every reference/source range. Effects are data, not renderer-provided commands or paths.
- Freeze the v0.1.1 v1/v2 parser in `contracts/legacy-project.ts`. Known projects migrate explicitly; originals and source offsets survive. The legacy soundtrack becomes a placed sound with an optional film-following duration. V3 never writes a second music field.
- Keep `contracts/project.ts` as the stable import facade; values, creative settings, current schema and compatibility parsing have separate responsibilities. Prefer named settings/limits to scattered implementation assumptions.
- Raise the model to 1,000 scenes, three hours, one-hour scenes, 100 undo entries and a bounded 16 MB manifest; originals still stream. A 500-photo/long-dedication use case has a regression check. Encoded/raster stress proof belongs to the composition slice, not this contract claim.
- Public web deployment follows verified, published release tags. Unreleased main commits must not write a schema that the currently downloadable desktop version cannot read. The policy verifies repository, event, release and commit, and prevents automatic rollback by an older rerun.
- Native smoke journeys use disposable workspaces; they do not upgrade the default installed application's data during testing.

Test surface: v1/v2 preservation, legacy soundtrack migration/ID collisions, malformed transforms/layer references, speed bounds, large tribute metadata, actual canonical-sound movie regression and released-source deployment checks. Advanced data fields are not declared implemented UI/export features until their own slices have runner proof.
<!-- keel:end -->
