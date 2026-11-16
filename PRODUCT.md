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
Local image/video/audio import; scene storyboard; title cards and overlays; trim/split; fit/fill; fade through black; undo/redo; aspect ratio; preview; local autosave; portable project download/open; 720p/1080p exports. Desktop exports MP4 using bundled FFmpeg; browser MP4 is offered where supported; other browsers transfer a portable project to desktop. Experimental WebM is deferred (ADR 004).

## Next-release hypotheses (brainstorm, 2026-11-16)
These are ranked product guesses for the existing family/tribute audience, not validated demand or committed implementation scope. Comparable features show possible expectations, not how many people want them. The account-free, local workflow and all three desktop systems remain settled.

| Priority guess | Missing job / current boundary | Candidate experience |
|---|---|---|
| First | Use the media already on my phone; HEIC is rejected and video decoding depends on the runtime | Local HEIF/HEIC and HEVC handling, correct orientation and HDR-to-SDR conversion; preserve originals and explain any unsupported file |
| First | Return to any unfinished film; only one working copy is autosaved | Recent projects with names/thumbnails, visible saved/recovered state, recovery snapshots and portable backup; never replace another project silently |
| Next | Turn a folder into a watchable slideshow without timing every scene | Editable draft sorted by capture date with an explicit fallback, fit photos to chosen music, bulk duration changes and a few holiday/birthday/tribute styles |
| Next | Hear the people and tell the story; one looping song only has volume control | Trim and place songs, add sequential songs, fades, voiceover recording and automatic music reduction under speech; keep the simple storyboard |
| Next | Keep faces visible and photos alive; fitting is centred and movement is absent | Drag the focal point, rotate, optional gentle pan/zoom and a restrained cross-dissolve; apply settings to selected photos together |
| Later | Understand spoken clips with sound off; scene titles are not timed subtitles | Editable subtitle timings and SRT import/export first; consider optional local transcription after measuring model size, speed and demand |
| Later | Finish with a file suitable for its destination; output currently exposes resolution only | Plain-language TV/phone/small-file presets, estimated size and a short export sample; validate 4K demand before adding it |

Recommendation guess: make the next release prove a mixed phone folder can become an editable draft, and that several named films can be resumed safely. Follow with sound and framing before captions or more effects. Browser export fallback (ADR 004 / issue #8), signing and a trustworthy update policy are wider-launch concerns; do not hide those behind new features.
Suggested validation tasks, not completed research: (1) a family storyteller imports their own mixed phone folder and produces a draft without an external converter; (2) a tribute maker fits photos to a song and keeps spoken words audible; (3) someone opens two projects, restarts and recovers the right film without losing either. Observe where assistance is needed before choosing implementation slices. No participant demand claims exist yet.
Explored and deferred: professional tracks/keyframes, generative effects, cloud accounts, social publishing integrations, a large stock catalogue and native mobile apps. They expand the product beyond the three jobs before those jobs are validated.

## Non-goals
- Professional multitrack editing, keyframes and compositing: these undermine the simple storyboard workflow.
- Cloud accounts, collaboration, stock libraries, AI generation and remote media: privacy and offline use are core constraints.
- HEIC/RAW decoding and arbitrary professional codecs in the first release: unsupported media receives a clear error.
- Automatic updates and paid signing services: require operator credentials and a distribution policy.

## v0.1.1 selection (user decision)
Implement phone-media compatibility, a project home/recovery, sound/narration, timed subtitles/SRT and sharing presets/sample export. Automatic slideshow creation and photo-presentation enhancements were explicitly declined. Optional local automatic transcription and 4K remain later candidates. The next-release recommendation above is superseded by this selection.

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
| [Microsoft storage troubleshooting](https://support.microsoft.com/en-gb/clipchamp/troubleshooting-onedrive-backed-clipchamp-editing-projects) and feature comparison | Editing projects can depend on active OneDrive; trim, titles and aspect ratios are baseline tasks | Cloud account and subscription flow |
| [Shotcut feature list](https://www.shotcut.org/features/) | Local format support and export controls are useful | Professional feature density |
| [OpenShot guide](https://www.openshot.org/user-guide/) | Import, arrange, preview and export is a comprehensible journey | Multitrack complexity |
| Next-release brainstorm: `contracts/project.ts`, `src/media/import.ts`, `src/components/Inspector.tsx` and `ARCHITECTURE.md`, inspected 2026-11-16 | Confirmed schema, decoder, sound, framing and single-working-project boundaries | Treating a source-code inspection as user research |
| [Apple media-format guidance](https://support.apple.com/en-gb/116944), inspected 2026-11-16 | iPhone/iPad HEIF and HEVC originals make format compatibility a relevant hypothesis | Assuming all phone media uses those formats |
| [iMovie iPhone guide](https://support.apple.com/guide/imovie-iphone/welcome/ios) and [Mac photo motion](https://support.apple.com/en-sg/guide/imovie/movc6e02f503/mac), inspected 2026-11-16 | Editable automatic drafts and optional start/end photo framing | Copying Apple's interface or assuming automatic motion suits every photo |
| [Clipchamp voice recorder](https://support.microsoft.com/en-us/clipchamp/how-to-use-the-voice-recorder) and [captions](https://support.microsoft.com/en-us/clipchamp/how-to-use-autocaptions-in-clipchamp), inspected 2026-11-16 | Narration recording, editable speech captions and SRT output | Cloud transcription: the documented captions flow sends audio to Azure |
| [Shotcut features](https://www.shotcut.org/features/), reinspected 2026-11-16 | Voiceover, audio ducking, HDR-to-SDR, subtitle interchange and capture-date sorting as candidates | Its professional mixing/filter surface and feature count as evidence of demand |

## Open questions
All unspecified choices are recorded rulings. Signing credentials, native mobile distribution and demand validation remain future operator decisions; they do not block an honest desktop preview.
<!-- keel:end -->
