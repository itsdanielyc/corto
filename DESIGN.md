<!-- keel:start -->
# Corto interface decisions

## Direction: a light table and a screen (approved 2026-11-20)
The film is the brightest thing in the room. Scenes are laid out on a light table (the reel) and judged on a dark screen (the stage). You change a moment on the moment itself: words and framing on the picture, transitions at the seam between two cards, everything else in a panel that follows the selection. Dialogs are only for starting a film (slideshow) and finishing one (export).

- **Signature:** Corto's mark is the play button, the playhead and the slider thumb. Pressing play slides the triangle behind the pillar and a second pillar appears: pause.
- **Colour:** monochrome on purpose; photographs supply colour. Ink is the accent (black in light, white in dark). Red appears only while recording.
- **Copy:** the interface does not explain the product back to the user. No "kept on this device", "no watermark" or "made on your computer" reassurance lines; status says what happened ("Saved"), labels say what a control does.
- Mockups: https://claude.ai/artifact/JD4SgZiTFmorEcpXGbyVEj (12 boards: editor, words, framing, sound, first launch, films, slideshow, export, palette, phone, window chrome, system).

## Tokens
Defined once in `src/styles/tokens.css`; components never hard-code colours.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | #F4F4F5 | #0E0E10 | window background |
| `--surface` | #FFFFFF | #151517 | panels |
| `--well` | #F1F1F3 | #1F1F23 | inputs, segmented controls |
| `--table` | #ECECEE | #0A0A0B | the reel |
| `--line` / `--line-2` | #E4E4E7 / #D4D4D8 | #26262A / #38383E | dividers / control borders |
| `--ink` / `--ink-2` / `--ink-3` | #0F0F10 / #3F3F46 / #6B6B74 | #F4F4F5 / #BCBCC3 / #8E8E97 | text levels; `--ink` is also the accent |
| `--stage` | #0C0C0D | #000000 | around the picture |
| `--record` | #E5484D | #E5484D | recording only |

Theme follows the system by default; Settings offers System, Light and Dark. On desktop the choice also sets the native theme, so title-bar controls match.

## Typography
Inter (bundled, variable) for the interface; tabular numerals for every time. Text is sized for reading, not density:

| Role | Size / weight |
|---|---|
| Smallest text anywhere (badges, card durations, keycaps) | 12px / 500 |
| Secondary text, field labels | 13px / 500 |
| Body, controls, menus | 14px / 450–500 |
| Panel titles | 15px / 600 |
| View titles (Films, dialogs) | 20–28px / 650, tracking −0.01em |

No uppercase micro-labels. Film text styles keep their own bundled fonts (Manrope, Nunito, DM Serif Display, JetBrains Mono).

## Geometry and motion
Radii 6 / 8 / 12px; controls 32px tall (40px on touch); 1px borders; shadows only on floating things (menus, popovers, sheets). Selection is an inset ink ring.
Easing `--ease` cubic-bezier(.22,1,.36,1) for arrivals, `--ease-io` (.65,0,.35,1) for moves. Durations: 120ms (press, hover), 200ms (panels, tabs), 240ms (cards moving), 340ms (sheets), 650ms (export premiere). Reduced motion keeps every state and drops the movement.

## Layout
- **Title bar:** mark (to Films), film name, save state, undo/redo, command search (Ctrl/⌘ K), more menu, Export. Draggable; macOS traffic lights inset, Windows caption buttons overlaid; Linux keeps the system frame.
- **Library (left):** Media, Music and Text tabs; import, search, sort, tiles.
- **Stage (centre):** the picture on `--stage`, time, previous / play / next, shape and full screen, then the mark-thumb scrubber.
- **Inspector (right):** follows the selection. A scene shows Picture (Clip / Card), Text, Overlays and Timing tabs; nothing selected shows the film (shape, defaults, bulk edits); sound and subtitles open here too.
- **Reel (bottom):** storyboard cards on the table, a transition control at every seam, a storyboard / timeline switch and the sound lane.
- **Films:** a full window view with starts (empty film, slideshow, templates) and recent films; not a modal.
- **Phone (< 760px):** title bar, stage, reel, bottom tabs (Edit, Media, Sound, Text) opening sheets.

## Accessibility and feedback (kept from v0.1)
Controls 32px minimum (40px on touch), visible focus, persistent field labels, named icon buttons, trapped and restored modal focus, no tooltip-only explanations of destructive actions. Autosave reports actual completion or failure; export shows real progress with a cancel control and runs while editing; missing media and unsupported codecs say how to recover; cancelled saves and exports are quiet. Source media is never modified.

## Earlier decisions still in force
- My films keeps thumbnails and recovery-as-copy; portable `.corto` copies remain the way to move a film.
- Sound, subtitles and export distinguish film time from source time and explain invalid bounds.
- Export choices name destinations, keep the film's aspect ratio and label size as an estimate; a five-second sample uses the same export path.
- Slideshow themes produce ordinary editable scenes in a separate film. Optional models explain their download before use.
<!-- keel:end -->
