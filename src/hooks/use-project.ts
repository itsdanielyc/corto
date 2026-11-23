import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "../../contracts/project";
import {
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
  type History,
} from "../domain/history";
import { createProject } from "../domain/project";
import type { CortoPlatform } from "../platform/types";

/**
 * "blank" is an untouched new film: nothing has been saved because there is
 * nothing to save yet, so the title bar says nothing rather than "Saved".
 */
export type SaveStatus =
  "loading" | "blank" | "pending" | "saving" | "saved" | "error";
export type ProjectOrigin = "new" | "draft" | "stored";
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
  // Only an untouched, newly created film can be skipped. A saved film can
  // legitimately have no scenes or assets after an edit or Undo.
  const untouched = useRef(true);
  // A confirmed local or portable copy lets a person leave safely even if
  // the storage device subsequently refuses writes.
  const recoverable = useRef<Project | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [canAutosave, setCanAutosave] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const canAutosaveRef = useRef(true);
  const allowAutosave = useCallback((allowed: boolean) => {
    canAutosaveRef.current = allowed;
    setCanAutosave(allowed);
  }, []);
  /**
   * An edit is on its way to disk only while autosave works; after a failed
   * load it stays unsaved, and the title bar says so instead of "Saving".
   */
  const markChanged = useCallback(() => {
    untouched.current = false;
    recoverable.current = null;
    setSaveStatus(canAutosaveRef.current ? "pending" : "error");
  }, []);

  const replace = useCallback(
    (project: Project, origin: ProjectOrigin = "draft") => {
      const next = createHistory(project);
      untouched.current = origin === "new";
      recoverable.current = origin === "stored" ? project : null;
      historyRef.current = next;
      setHistory(next);
      allowAutosave(true);
      setSaveStatus(untouched.current ? "blank" : "pending");
    },
    [allowAutosave],
  );

  useEffect(() => {
    let cancelled = false;
    void platform
      .loadProject()
      .then(async (project) => {
        if (cancelled) return;
        if (project) replace(project, "stored");
        else if (platform.loadPreferences) {
          const preferences = await platform.loadPreferences();
          if (!cancelled)
            replace(
              {
                ...createProject(),
                defaults: preferences.defaults,
                output: preferences.output,
              },
              "new",
            );
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
    if (untouched.current) {
      setSaveStatus("blank");
      return;
    }
    setSaveStatus("pending");
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      void platform
        .saveProject(snapshot)
        .then(() => {
          if (historyRef.current.present === snapshot) {
            recoverable.current = snapshot;
            setSaveStatus("saved");
          }
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
    if (next === historyRef.current) return;
    historyRef.current = next;
    markChanged();
    setHistory(next);
  }, [markChanged]);
  const redo = useCallback(() => {
    const next = redoHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    markChanged();
    setHistory(next);
  }, [markChanged]);

  /** Flush edits before navigation, preserving an unreadable working copy for recovery. */
  const saveCurrent = useCallback(async () => {
    if (untouched.current) return;
    const snapshot = historyRef.current.present;
    if (!canAutosaveRef.current) {
      if (recoverable.current === snapshot) return;
      throw new Error(
        "Save a portable copy of these edits before opening another film.",
      );
    }
    try {
      await platform.saveProject(snapshot);
      if (historyRef.current.present === snapshot)
        recoverable.current = snapshot;
    } catch (failure) {
      if (recoverable.current !== snapshot) throw failure;
    }
  }, [platform]);

  const savePortableCopy = useCallback(async () => {
    const snapshot = historyRef.current.present;
    const saved = await platform.savePortable(snapshot);
    if (saved && historyRef.current.present === snapshot)
      recoverable.current = snapshot;
    return saved;
  }, [platform]);

  const hasUnsavedEdits = useCallback(
    () =>
      !untouched.current && recoverable.current !== historyRef.current.present,
    [],
  );

  return {
    project: history.present,
    current: historyRef,
    loaded,
    saveStatus,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commit,
    replace,
    saveCurrent,
    hasUnsavedEdits,
    savePortableCopy,
    undo,
    redo,
  };
}
