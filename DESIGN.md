<!-- keel:start -->
# Corto interface decisions

Corto is a miille app. The family contract, shared word for word with Plico and Onda, is
[docs/design/miille.md](docs/design/miille.md): a grey desk, a white sheet, black ink, the graphite
tile for brand moments, Onda's type scale, controls, voice and behaviour. This file records only
what is particular to Corto. Target renders: [docs/design/miille/](docs/design/miille/).

## Direction: a light table and a screen, on the miille desk (2026-11-22)
The film is the brightest thing in the room. Scenes are laid out on a light table (the reel) and
judged on a screen (the stage). You change a moment on the moment itself: words and framing on the
picture, transitions at the seam between two cards, everything else in a panel that follows the
selection. Dialogs are only for starting a film (slideshow), finishing one (export) and the rare
question that cannot be undone.

- **Signature:** Corto's mark is the play button, the playhead and the slider thumb. Play is the
  brightest control on the screen: the mark in ink on a white disc. Pressing play slides the triangle
  behind the pillar and a second pillar appears: pause.
- **Colour:** monochrome on purpose; photographs supply colour. Ink is the accent. Red appears only
  while recording. Template starts are drawn on the graphite or light tile in their own typeface,
  never in invented colours.
- **Copy:** the family voice. Status says what happened ("Saved"), labels say what a control does,
  units are always shown ("5 s"), no reassurance lines.

## Shell
- **Desk (`--base`):** the title bar and the left column, one grey surface with no line between
  them. In the editor the left column is the media library; on Films and Settings the same column
  holds the ways to start or the settings sections, so the window keeps its shape as you move.
- **Sheet (`--panel`):** everything else is one white sheet, 6 px below the title bar, 12 px
  top-left radius, a 1 px `--line` edge on top and left. In the editor it holds the stage and the
  inspector over the reel; on Films and Settings it holds the page (30 px title, one-line lede,
  max 1040 / 920 px, left-aligned, 34/44/56 padding).
- **Screen:** the stage is a dark card set into the sheet (12 px inset, 16 px radius) carrying the
  picture and the transport. With no film yet it becomes the graphite tile with Onda's soft light:
  the mark, "Make something worth keeping.", a white primary and a ghost secondary.
- **Reel:** the reel sits on `--sunken` inside the sheet, under the stage and the inspector, so it
  keeps the window's full working width for time.
- **Title bar (44 px):** mark and "Films" (or "Corto" off the editor), film name, save state,
  command search with its keycap, undo / redo, more menu, Export. Windows caption buttons overlay it
  in `--base` with `--fg-2` glyphs (`electron/window-chrome.ts`); macOS traffic lights are inset;
  Linux keeps the system frame. Below 1060 px the search keeps its icon and keycap.
- **Status card:** background exports are a card pinned at the foot of the desk column (Onda's
  status card), never a row that pushes the editor down. Each job shows progress and cancel; a
  finished film offers its folder and steps aside after ten seconds; failures wait to be read.
- **Toasts:** ink, bottom right (`--radius-toast`), one action.
- **Films:** the desk lists Back to my film, then Start (New film, Slideshow) and Templates as rows
  with tiles, then Settings. The sheet is the page: "Films", a lede, Open portable project, and the
  recent films as a poster grid.
- **Settings:** a place, opened from the more menu, the palette, Films or Ctrl / ⌘ ,. The desk lists
  General, New scenes, Timeline, Downloads, Updates and help; the sheet shows one section as Onda's
  rows (36 px icon tile, 16 px title, one-sentence description, control at the right). Every change
  saves as it happens; Back returns to wherever Settings was opened from. Appearance is three
  preview cards (Match the system, Light, Dark).
- **Phone (< 760 px):** title bar, stage, reel, bottom tabs (Edit, Media, Sound, Text) opening
  sheets. The phone title bar shows the mark and the film name.

## Editor density
The editor keeps the family's type scale and controls but runs them compact where it must: panel
controls are `--control-h-sm` (32 px, 40 on touch), section titles in the inspector are 15 / 640,
field labels 14 / 540. Pages and dialogs use `--control-h` (38 px). Badges drawn on a picture (scene
number, duration) use `--text-badge` (12 px); nothing else goes below 13 px.

## Tokens
`src/styles/tokens.css` uses the family names and values (`--base`, `--panel`, `--raised`,
`--sunken`, `--line`, `--line-strong`, `--fg`, `--fg-2`, `--fg-3`, `--on-fg`, `--ok`, `--warn`,
`--err`, `--tile`, …) plus Corto's own: `--sunken-2` (thumbnail wells), `--stage`, `--stage-2`,
`--stage-fg`, `--stage-fg-2`, `--stage-line`, `--record`, `--text-badge`, `--radius-popover` /
`-toast` / `-dialog`, `--dur-move` (cards, 240 ms), `--dur-sheet` (phone sheets, 340 ms),
`--dur-reveal` (the export premiere, 650 ms) and the window sizes. Components read tokens, never hex
values, except the fixed white and ink used on the graphite tile and the screen.

## Accessibility and feedback (kept from v0.1)
Controls 32 px minimum (40 px on touch), visible focus, persistent field labels, named icon buttons,
trapped and restored modal focus, no tooltip-only explanations of destructive actions. Autosave
reports actual completion or failure; export shows real progress with a cancel control and runs
while editing; missing media and unsupported codecs say how to recover; cancelled saves and exports
are quiet. Source media is never modified.

## Earlier decisions still in force
- Films keeps thumbnails and recovery-as-copy; portable `.corto` copies remain the way to move a film.
- Sound, subtitles and export distinguish film time from source time and explain invalid bounds.
- Export choices name destinations, keep the film's aspect ratio and label size as an estimate; a
  five-second sample uses the same export path.
- Slideshow themes produce ordinary editable scenes in a separate film. Optional models explain
  their download before use.

## Decision log
- 2026-11-20: "A light table and a screen" approved (PR #22).
- 2026-11-22: Corto joins the miille family shell: grey desk, white sheet with Onda's inset corner,
  the screen as a card on the sheet, the library on the desk. Tokens renamed to the family names;
  type moved to Onda's scale (13 px floor, 15 px body, 30 / 720 page titles); Onda's buttons,
  switches, segmented controls, keycaps, menus, dialogs (18 px, sticky footer) and palette.
- 2026-11-22: Films rebuilt as a miille page (ways to start on the desk, films on the sheet);
  templates drawn monochrome on the brand tiles.
- 2026-11-22: Settings became a page that saves as it changes, replacing a two-column dialog whose
  layout had broken and whose Cancel did not undo the theme. "Settings & defaults" is now "Settings".
- 2026-11-22: Background exports became a status card at the foot of the desk column, because the
  export row reflowed every panel by 55–65 px when a job started or finished.
<!-- keel:end -->
