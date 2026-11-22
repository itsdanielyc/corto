import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../../contracts/project";
import {
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
  type History,
} from "../domain/history";
import { createProject, isBlankProject } from "../domain/project";
import type { CortoPlatform } from "../platform/types";

/**
 * "blank" is an untouched new film: nothing has been saved because there is
 * nothing to save yet, so the title bar says nothing rather than "Saved".
 */
export type SaveStatus =
  "loading" | "blank" | "pending" | "saving" | "saved" | "error";
const AUTOSAVE_DELAY_MS = 500;

/** Keep pure edit history separate from serialized asynchronous persistence. */
export function useProject(
  platform: CortoPlatform,
  report: (error: unknown) => void,
  paused = false,
) {
  const [history, setHistory] = useState<History<Project>>(() =>
    createHistory(createProject()),
  );
  const historyRef = useRef(history);
  const [loaded, setLoaded] = useState(false);
  const [canAutosave, setCanAutosave] = useState(true);
  const canAutosaveRef = useRef(true);
  const allowAutosave = useCallback((allowed: boolean) => {
    canAutosaveRef.current = allowed;
    setCanAutosave(allowed);
  }, []);
  /**
   * An edit is on its way to disk only while autosave works; after a failed
   * load it stays unsaved, and the title bar says so instead of "Saving".
   */
  const markChanged = useCallback(
    () => setSaveStatus(canAutosaveRef.current ? "pending" : "error"),
    [],
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");

  const replace = useCallback(
    (project: Project) => {
      const next = createHistory(project);
      historyRef.current = next;
      setHistory(next);
      allowAutosave(true);
      setSaveStatus("pending");
    },
    [allowAutosave],
  );

  useEffect(() => {
    let cancelled = false;
    void platform
      .loadProject()
      .then(async (project) => {
        if (cancelled) return;
        if (project) replace(project);
        else if (platform.loadPreferences) {
          const preferences = await platform.loadPreferences();
          if (!cancelled)
            replace({
              ...createProject(),
              defaults: preferences.defaults,
              output: preferences.output,
            });
        }
        if (!cancelled) setLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        allowAutosave(false);
        setSaveStatus("error");
        setLoaded(true);
        report(error);
      });
    return () => {
      cancelled = true;
    };
  }, [platform, replace, report, allowAutosave]);

  useEffect(() => {
    if (!loaded || !canAutosave || paused) return;
    const snapshot = history.present;
    if (isBlankProject(snapshot)) {
      setSaveStatus("blank");
      return;
    }
    setSaveStatus("pending");
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      void platform
        .saveProject(snapshot)
        .then(() => {
          if (historyRef.current.present === snapshot) setSaveStatus("saved");
        })
        .catch((error) => {
          if (historyRef.current.present === snapshot) setSaveStatus("error");
          report(error);
        });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [history.present, loaded, canAutosave, paused, platform, report]);

  const commit = useCallback(
    (edit: (project: Project) => Project) => {
      try {
        const previous = historyRef.current;
        const next = commitHistory(previous, edit(previous.present));
        historyRef.current = next;
        if (next !== previous) markChanged();
        setHistory(next);
      } catch (error) {
        report(error);
      }
    },
    [report, markChanged],
  );

  const undo = useCallback(() => {
    const next = undoHistory(historyRef.current);
    historyRef.current = next;
    markChanged();
    setHistory(next);
  }, [markChanged]);
  const redo = useCallback(() => {
    const next = redoHistory(historyRef.current);
    historyRef.current = next;
    markChanged();
    setHistory(next);
  }, [markChanged]);

  return {
    project: history.present,
    current: historyRef,
    loaded,
    saveStatus,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    replace,
    undo,
    redo,
  };
}
