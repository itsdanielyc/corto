<!-- keel:start -->
# Corto

Corto by miille is an account-free home video and slideshow maker for people who want to turn photos, short clips, music and a few words into a film worth keeping. It brings a simple, local workflow to Windows, macOS, Linux and the web. The opportunity is the user's stated need for a Movie Maker replacement; demand has not been independently measured.

## Audience and jobs
- A family storyteller assembling a holiday, birthday or everyday memory: pick media, put it in order, add music, export.
- Someone making a tribute or event slideshow: control timing, add readable titles, save an editable copy, work without cloud storage.
- An occasional creator sharing a short film: choose landscape, portrait or square without learning a professional editor.

## Surfaces
- Windows, macOS and Linux desktop applications are first-class surfaces.
- A browser application uses the same editor with local browser storage and downloadable project files.
- Ruling: mobile receives a usable responsive web layout; native iOS/Android applications are deferred because the brief explicitly names three desktop systems. Cost if wrong: a later mobile packaging phase.

## Experience
Open directly into a calm editor. No account screen, upload or onboarding gate.
Use the supplied monochrome identity, generous spacing and precise, quiet controls.
The media library, large preview and chronological storyboard should explain themselves.
Adding a photo creates a sensibly timed scene; adding a clip preserves its source duration within the project limits.
Let people reorder, trim, split, duplicate, remove and undo without managing tracks.
Titles belong to scenes. Music spans the film and can loop with adjustable volume.
Show real playback, durations, save state, export progress and actionable errors.
Include an explicitly named example project so someone can understand the editor before importing anything.
Private media never leaves the device. No analytics, remote fonts, advertising or watermarks.

## Success criteria (targets are product judgments)
1. Import two photos and a video, reorder them, add a title and music, and export a playable movie: automated browser and real-shell journeys.
2. Save and reopen an editable project without an account or network request: persistence integration and real-shell tests.
3. Export landscape, portrait and square movies with scene timing and sound: model tests and native export integration checks.
4. Install, launch and remove release builds on Windows, macOS and Linux: hosted runner installer round trips.
5. Operate essential actions by keyboard with named controls and readable contrast: browser keyboard journey and reviewed screenshots.

## First release scope
Local image/video/audio import; scene storyboard; title cards and overlays; trim/split; fit/fill; fade through black; undo/redo; aspect ratio; preview; local autosave; portable project download/open; 720p/1080p exports. Desktop exports MP4 using bundled FFmpeg; browser output depends on supported recording codecs and is identified before export.

## Non-goals
- Professional multitrack editing, keyframes and compositing: these undermine the simple storyboard workflow.
- Cloud accounts, collaboration, stock libraries, AI generation and remote media: privacy and offline use are core constraints.
- HEIC/RAW decoding and arbitrary professional codecs in the first release: unsupported media receives a clear error.
- Automatic updates and paid signing services: require operator credentials and a distribution policy.

## Risks and rulings
- Browser codec support differs: detect capabilities; tell people the available output; test browser and native exports separately.
- Video rendering can exhaust memory: stream native export per scene, bound file sizes and project lengths, cancel cleanly.
- Media persistence may exceed browser quota: fail visibly and keep portable project download available.
- Ruling: ship unsigned preview installers when signing credentials are absent; document OS warnings. No paid account or certificate purchase is authorised.
- Ruling: use `itsdanielyc/corto`; exact organisation `miille` was unavailable (GitHub API 404). The account also administers `miillehq`, but that is not the requested organisation.
- Ruling: the user authorised autonomous implementation, repository creation and delivery. Phase approval pauses are waived by that explicit instruction; technical evidence gates remain mandatory.

## Provenance (2026-11-16)
| Source actually inspected | Learned / borrowed | Deliberately avoided |
|---|---|---|
| User's product prompt | Local Movie Maker replacement; three desktop systems; photos, clips, music, titles | Treating asserted demand as market data |
| Supplied brand README and four-page logo guidelines | Original icons/wordmark; graphite, white and greys; Corto by miille | Recolouring or redrawing the identity |
| [Microsoft storage troubleshooting](https://support.microsoft.com/en-us/clipchamp/troubleshooting-cloud-storage-issues-in-clipchamp) and feature comparison | Editing projects can depend on active OneDrive; trim, titles and aspect ratios are baseline tasks | Cloud account and subscription flow |
| [Shotcut feature list](https://www.shotcut.org/features/) | Local format support and export controls are useful | Professional feature density |
| [OpenShot guide](https://www.openshot.org/user-guide/) | Import, arrange, preview and export is a comprehensible journey | Multitrack complexity |

## Open questions
All unspecified choices are recorded rulings. Signing credentials, native mobile distribution and demand validation remain future operator decisions; they do not block an honest desktop preview.
<!-- keel:end -->
