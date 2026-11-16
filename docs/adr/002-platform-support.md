<!-- keel:start -->
# ADR 002: Platform support
Status: accepted. Date: 2026-11-16.

| Tier | Platforms | Promise |
|---|---|---|
| 1 | windows-x64, macos-arm64, linux-x64 | Browser journeys, real-shell journeys and installer round trips must pass before release. |
| 2 | macos-x64 | Real-shell tests before release; separate Intel Mac bundle. |
| 3 | none, by decision | Other Linux distributions need dedicated packaging checks before a support claim. |

The web target is a static application with local storage; Chromium is the reference browser. Feature detection determines recording format. The web app supports responsive small screens, but native iOS/Android packaging is not promised in this release.

Ruling: Windows/Linux arm64 are deferred pending a native FFmpeg distribution and full installer evidence; the user's three-system requirement is covered by Tier 1. A build that has not run is never described as supported.

Every PR runs fast checks once and browser plus real-shell journeys on Tier 1. Intel macOS runs nightly and before release. Installer jobs run on main and before tags. Target cost: under 20 minutes wall clock per PR, under 25 minutes per installer job; these are budgets, not observed times.

Move a platform into Tier 1 only after its essential journeys and installer round trips are repeatably green. Remove support only by a superseding ADR that names the failed evidence. Extra bundle formats are previews until their own round trips pass.
<!-- keel:end -->
