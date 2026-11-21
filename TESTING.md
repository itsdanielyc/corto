<!-- keel:start -->
# Testing strategy

| Level | Tool / command | Guards |
|---|---|---|
| L0 | `npm run typecheck` | Renderer, main/preload and suites have isolated strict type contexts. |
| L1 | `npm run test:unit` | Timing, trim/split/reorder, validation, title layout and bounded history. |
| L2 | `npm run test:unit` | Shared project and platform contracts, mock and file-backed persistence conformance. |
| L3 | `npm run test:integration` | Atomic project I/O, real FFmpeg outputs and cancellation cleanup. |
| L4/L5 | `npm run test:ui` | Browser editing, keyboard, persistence, portable projects, ARIA/geometry/pixels. |
| L6 | `npm run test:e2e` after build | Native save/reopen and real exported film through UI/IPC. |
| L7 | platform installer scripts | NSIS, DMG, DEB and AppImage install/launch/remove. |
| L8 | deferred, advisory | Other Linux distributions and real assistive-technology sessions. |

## Critical journeys
1. Import local media, add/reorder scenes, trim and undo: L1 and L4.
2. Add readable captions/title cards and change framing/aspect ratio: L1, L4 and L5.
3. Save/reopen with source media intact: L2, L3 and L6.
4. Export playable video with source sound and background music: L3 and L6, browser recording at L4.
5. Reject corrupt/unsupported projects and report storage/export errors: L1-L4.
6. Install and launch the actual release bundle: L7 on every Tier 1 OS family.
7. Multiple named films, last-edit recovery and corrupt catalogue isolation: L2/L3/L4/L6.
8. Real HEIC/HEVC/HDR originals, local compatible copies, recorded narration, timed sound/subtitles and sample exports: L1/L3/L4/L6; assert actual movie pixels and independent audio tone levels.

## Creator-tools surface
- Pure checks: v3 migration/reference bounds, overlap timing/frame budgets, transforms/focal points/motion, speed/source offsets, selection/clipboard, slideshow fit/date fallback and output ranges.
- Real I/O: transformed/transition/overlay/text pixels and soundtrack levels in encoded outputs, legacy conversion, capture derivatives, large caption staging, originals across project/history operations and job cancellation.
- Browser/native journeys: beginner slideshow, crop/motion + transition, timed credits/PiP, bulk editing, project recovery/file open, optional local features and background export while editing.
- Capability-dependent hardware and physical devices are named honestly. Model tests use pinned open models and synthetic/redistributable fixtures. No competitor assertion substitutes for a behaviour check.

## Redesigned interface (slices 27–33)
Each line names the test that carries it; all enter through the shipped editor or the built app.
- Transition picked at a seam and applied to every join, command palette from the keyboard, start/end framing and words edited on the picture, a pressed or cancelled framing drag changing nothing, appearance kept across reload: `tests/ui/redesign.spec.ts` (L4).
- Framing rectangles equal what the renderer shows and stay inside the schema's zoom range, the drop summary, the appearance guard and the frame each OS gets: `tests/unit/redesign.test.ts` (L1).
- `tests/ui/panel-layout.spec.ts` measures the photo, clip, title-card and side-panel controls at 320, 390, 1024 and 1440 px. It also operates the transition picker at 320 × 568 (L4/L5).
- `tests/ui/concurrent-edits.spec.ts` delays real reads and saves while the user edits or changes views. It checks the saved film after SRT import, Auto Enhance, template creation and slideshow creation (L4).
- `tests/ui/output-tools.spec.ts` cancels a waiting background export, downloads the running film and checks the finished notice clears the inspector heading (L4/L5). `tests/ui/creator.spec.ts` compares the fitted timing shown for a mixed-media slideshow with its saved scenes (L4).
- Narration counts down before recording, cancelling the countdown releases the microphone and records nothing: `tests/ui/voice.spec.ts` (L4); narration through the real shell: `tests/e2e/essentials.spec.ts` (L6).
- The appearance channel refuses anything but the three choices and the preload reports the frame the main process built: `tests/e2e/app.spec.ts` (L6).
- The production web build offline: `tests/web/offline.spec.ts`; the experimental WebM capture offline: `tests/advisory/offline-webm.spec.ts` (advisory, weekly).

## Visual evidence
ARIA structure and geometry (8 px tolerance) share baselines across OSes. Pixel baselines are per-OS, 0.002 maximum difference ratio, captured only by the snapshots workflow and reviewed before merge. Real-shell screenshots form a contact sheet. First run's missing baseline is an expected red, never a suppressed pass.

## Policy and budgets
Every new test is observed red before trusted; record the message in the ledger. Flaky tests keep running advisory with a linked issue; fix the cause, not the timeout. One retry is allowed at L6/L7 only. Fast suite budget is three minutes; browser suite five minutes/OS; whole PR twenty minutes. Native rendering gets its own integration job if it exceeds the fast budget.

No claim is broader than `VERIFICATION.md`: level, platform, timestamp/run and command. Browser tests use the labelled mock. Native tests bypass OS dialogs through test-only preset destinations. Export tests inspect the actual encoded movie, not just a successful command.

## Deliberately unverified initially
Paid signing/notarization, native mobile installers, RAW/professional codecs, uncommon phone codec profiles beyond the fixtures, screen-reader sessions and unsupported CPU architectures. These remain named gaps until actual evidence exists. Microphone automation uses a real capture API with a synthetic test device, not physical microphone certification on every OS. Optional cold model tests run separately with `playwright.models.config.ts` and the native `local_models` workflow matrix; the 500-photo encode uses `CORTO_STRESS_TESTS=1`.
<!-- keel:end -->
