import { useEffect, type RefObject } from "react";
import { PANEL_DIALOGS, type EditorDialog } from "../components/EditorDialogs";

interface EditorShortcutsProperties {
  state: RefObject<{ busy: string | null; dialog: EditorDialog }>;
  savePortable: () => void;
  requestOpen: () => void;
  redoEdit: () => void;
  undoEdit: () => void;
  togglePlayback: () => void;
  deleteSelected: () => void;
  moveSelected: (direction: number) => void;
  sceneAction: (action: string) => void;
  seekByKey: (key: string) => void;
}

/** Keep shortcut policy and editable-field exclusions independent of project and media effects. */
export function useEditorShortcuts({
  state: ui,
  savePortable,
  requestOpen,
  redoEdit,
  undoEdit,
  togglePlayback,
  deleteSelected,
  moveSelected,
  sceneAction,
  seekByKey,
}: EditorShortcutsProperties) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      // Side panels (sound, subtitles, bulk edits) keep the editor live; real dialogs do not.
      if (
        ui.current.busy ||
        (ui.current.dialog && !PANEL_DIALOGS.has(ui.current.dialog)) ||
        document.querySelector("dialog[open]")
      )
        return;
      const editable =
        event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea,select") ||
          event.target.isContentEditable);
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        savePortable();
      } else if (modifier && event.key.toLowerCase() === "o") {
        event.preventDefault();
        requestOpen();
      } else if (!editable && modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undoEdit();
      } else if (!editable && modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoEdit();
      } else if (!editable && event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) togglePlayback();
      } else if (
        !editable &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        deleteSelected();
      } else if (!editable && event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelected(-1);
      } else if (!editable && event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        moveSelected(1);
      } else if (
        !editable &&
        modifier &&
        ["a", "c", "x", "v", "d"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        const actions: Record<string, string> = {
          a: "select-all",
          c: "copy",
          x: "cut",
          v: "paste",
          d: "duplicate",
        };
        sceneAction(actions[event.key.toLowerCase()]);
      } else if (!editable && !modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        sceneAction("split");
      } else if (
        !editable &&
        !modifier &&
        ["Home", "End", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        seekByKey(event.key);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [
    savePortable,
    requestOpen,
    redoEdit,
    undoEdit,
    togglePlayback,
    deleteSelected,
    moveSelected,
    sceneAction,
    seekByKey,
  ]);
}
