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

export type SaveStatus = "loading" | "pending" | "saving" | "saved" | "error";
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");

  const replace = useCallback((project: Project) => {
    const next = createHistory(project);
    historyRef.current = next;
    setHistory(next);
    setCanAutosave(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void platform
      .loadProject()
      .then((project) => {
        if (cancelled) return;
        if (project) replace(project);
        setLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setCanAutosave(false);
        setSaveStatus("error");
        setLoaded(true);
        report(error);
      });
    return () => {
      cancelled = true;
    };
  }, [platform, replace, report]);

  useEffect(() => {
    if (!loaded || !canAutosave || paused) return;
    const snapshot = history.present;
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
        setHistory(next);
      } catch (error) {
        report(error);
      }
    },
    [report],
  );

  const undo = useCallback(() => {
    const next = undoHistory(historyRef.current);
    historyRef.current = next;
    setHistory(next);
  }, []);
  const redo = useCallback(() => {
    const next = redoHistory(historyRef.current);
    historyRef.current = next;
    setHistory(next);
  }, []);

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
