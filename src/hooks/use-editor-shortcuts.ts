import { useEffect, type RefObject } from "react";
import type { EditorDialog } from "../components/EditorDialogs";

interface EditorShortcutsProperties {
  state: RefObject<{ busy: string | null; dialog: EditorDialog }>;
  savePortable: () => void;
  requestOpen: () => void;
  redoEdit: () => void;
  undoEdit: () => void;
  togglePlayback: () => void;
  deleteSelected: () => void;
  moveSelected: (direction: number) => void;
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
}: EditorShortcutsProperties) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        ui.current.busy ||
        ui.current.dialog ||
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
  ]);
}
