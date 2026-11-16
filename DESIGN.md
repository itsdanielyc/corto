<!-- keel:start -->
# Corto interface decisions

## Direction
A quiet, light creative workspace with a graphite preview surround. Supplied black lockup on white; the original dark app icon in docks. No added brand colour. Photography provides colour; selection and primary actions use black/white. Rounded controls are restrained, borders subtle, shadows limited to floating menus and dialogs.

## Layout
- Header: Corto lockup, editable project name, save state, undo/redo, project menu and Export movie.
- Left: narrow navigation rail plus media library, search, import and explanatory local-storage footer.
- Centre: project heading, aspect selector, large 16:9 canvas, playback and scrubber.
- Right: selected scene timing, caption/title style, framing, transition and audio controls.
- Bottom: horizontally scrollable storyboard with numbered thumbnails, durations and a real playhead; music lane below.
- Empty state explains the next action and offers a clearly labelled example project. Example media never masquerades as imported personal content.

## Typography and accessibility
Bundle a sans-serif font so layouts are stable offline. Use tabular numbers for time. Body copy is at least 13px; interactive targets at least 32px, larger on touch screens. Focus rings are visible, buttons have accessible names, field labels are persistent, modal focus is trapped and restored. Reduced-motion preference suppresses decorative animation. Avoid tooltips as the only explanation of destructive actions.

## Small screens
At narrow widths the library and inspector become explicit panels above a full-width preview. Essential storyboard, playback, import and export stay reachable. No forced desktop viewport or hidden overflow trap.

## Feedback
Autosave reports actual completion/failure. Export shows actual progress and a cancel control. Missing media and unsupported codecs explain how to recover. Save/export cancellations are quiet. Source photos and clips remain immutable. Every visible control either performs its named action or is disabled with an explanation.

## Tool choice
The Product Design router was inspected; it excludes ordinary implementation. This task uses its existing brand material and this decision log rather than introducing a separate design exploration/approval workflow.

## v0.1.1
- My films is reachable from the header/brand and project menu, with thumbnails and an explicit recovery-as-copy action.
- Sound & narration and Timed subtitles use focused, keyboard-accessible panels. Persistent labels distinguish film time from original-source time; invalid edits explain their bounds.
- Export choices name destinations, preserve the chosen aspect ratio and label size as an estimate. A sample uses the same export path.
- Automatic slideshow creation and photo-presentation enhancements were explicitly declined. The scene editor, brand and photo-framing controls keep their existing scope.
<!-- keel:end -->
