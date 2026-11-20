import { useMemo } from "react";
import type { Project, Scene } from "../../contracts/project";
import type { Command } from "./CommandPalette";
import type { InspectorTab } from "./Inspector";
import { RATIO_CHOICES } from "./Stage";
import { TRANSITION_CHOICES } from "./tools/choice-lists";
import { shortcutLabel } from "./shortcut-label";

interface CommandActions {
  togglePlayback: () => void;
  undo: () => void;
  redo: () => void;
  importMedia: () => void;
  importMusic: () => void;
  importFolder: () => void;
  addTitle: () => void;
  exportMovie: () => void;
  sound: () => void;
  subtitles: () => void;
  filmTools: () => void;
  slideshow: () => void;
  films: () => void;
  newFilm: () => void;
  open: () => void;
  save: () => void;
  settings: () => void;
  capture: () => void;
  help: () => void;
  about: () => void;
  timeline: (enabled: boolean) => void;
  ratio: (ratio: Project["ratio"]) => void;
  tab: (tab: InspectorTab) => void;
  transition: (transition: Scene["transition"]) => void;
  sceneAction: (action: string) => void;
  frame: () => void;
}

/** Every command the palette can run, in the order people reach for them. */
export function useEditorCommands({
  project,
  selected,
  playing,
  canUndo,
  canRedo,
  timelineMode,
  actions,
}: {
  project: Project;
  selected: Scene | null;
  playing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  timelineMode: boolean;
  actions: CommandActions;
}): Command[] {
  const empty = !project.scenes.length;
  const photo =
    !!selected?.assetId && project.assets[selected.assetId]?.kind === "image";
  return useMemo(
    () => [
      {
        id: "play",
        group: "Playback",
        label: playing ? "Pause" : "Play",
        shortcut: "Space",
        disabled: empty,
        run: actions.togglePlayback,
      },
      {
        id: "import",
        group: "Add",
        label: "Import photos and clips",
        run: actions.importMedia,
      },
      {
        id: "import-folder",
        group: "Add",
        label: "Import a folder",
        run: actions.importFolder,
      },
      {
        id: "import-music",
        group: "Add",
        label: "Import music",
        run: actions.importMusic,
      },
      {
        id: "title",
        group: "Add",
        label: "Add title card",
        run: actions.addTitle,
      },
      {
        id: "capture",
        group: "Add",
        label: "Record camera or screen",
        run: actions.capture,
      },
      {
        id: "words",
        group: "Scene",
        label: "Add words to this scene",
        disabled: !selected,
        run: () => actions.tab("text"),
      },
      {
        id: "framing",
        group: "Scene",
        label: "Set start and end on the picture",
        disabled: !photo,
        run: actions.frame,
      },
      {
        id: "split",
        group: "Scene",
        label: "Split scene at playhead",
        shortcut: "S",
        disabled: !selected,
        run: () => actions.sceneAction("split"),
      },
      {
        id: "duplicate",
        group: "Scene",
        label: "Duplicate scene",
        shortcut: shortcutLabel("D"),
        disabled: !selected,
        run: () => actions.sceneAction("duplicate"),
      },
      {
        id: "delete",
        group: "Scene",
        label: "Delete scene",
        shortcut: "Delete",
        disabled: !selected,
        run: () => actions.sceneAction("delete"),
      },
      ...TRANSITION_CHOICES.map(([transition, label]) => ({
        id: `transition-${transition}`,
        group: "Transition into the next scene",
        label,
        disabled: !selected,
        run: () => actions.transition(transition),
      })),
      {
        id: "undo",
        group: "Edit",
        label: "Undo",
        shortcut: shortcutLabel("Z"),
        disabled: !canUndo,
        run: actions.undo,
      },
      {
        id: "redo",
        group: "Edit",
        label: "Redo",
        shortcut: shortcutLabel("Z", true),
        disabled: !canRedo,
        run: actions.redo,
      },
      {
        id: "sound",
        group: "Film",
        label: "Sound & narration",
        run: actions.sound,
      },
      {
        id: "subtitles",
        group: "Film",
        label: "Timed subtitles",
        run: actions.subtitles,
      },
      {
        id: "film-tools",
        group: "Film",
        label: "Film tools & bulk edits",
        disabled: empty,
        run: actions.filmTools,
      },
      ...RATIO_CHOICES.map(([ratio, label]) => ({
        id: `ratio-${ratio}`,
        group: "Film",
        label: `Shape: ${label}`,
        run: () => actions.ratio(ratio),
      })),
      {
        id: "timeline",
        group: "View",
        label: timelineMode ? "Show storyboard" : "Show timeline",
        run: () => actions.timeline(!timelineMode),
      },
      {
        id: "export",
        group: "Finish",
        label: "Export movie",
        disabled: empty,
        run: actions.exportMovie,
      },
      {
        id: "slideshow",
        group: "Finish",
        label: "Make a slideshow",
        run: actions.slideshow,
      },
      {
        id: "films",
        group: "Films",
        label: "My films",
        run: actions.films,
      },
      {
        id: "new",
        group: "Films",
        label: "New film",
        run: actions.newFilm,
      },
      {
        id: "open",
        group: "Films",
        label: "Open project",
        shortcut: shortcutLabel("O"),
        run: actions.open,
      },
      {
        id: "save",
        group: "Films",
        label: "Save portable copy",
        shortcut: shortcutLabel("S"),
        run: actions.save,
      },
      {
        id: "settings",
        group: "Corto",
        label: "Settings & defaults",
        run: actions.settings,
      },
      {
        id: "help",
        group: "Corto",
        label: "Keyboard shortcuts",
        run: actions.help,
      },
      {
        id: "about",
        group: "Corto",
        label: "About Corto",
        run: actions.about,
      },
    ],
    [actions, playing, empty, selected, photo, canUndo, canRedo, timelineMode],
  );
}
