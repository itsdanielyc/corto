import { LIMITS } from "../../contracts/project";

export interface History<T> {
  past: readonly T[];
  present: T;
  future: readonly T[];
}

/** Start an undo history without cloning immutable state. */
export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Commit a structural-sharing edit and release snapshots beyond the memory budget. */
export function commitHistory<T>(
  history: History<T>,
  present: T,
  capacity: number = LIMITS.history,
): History<T> {
  if (history.present === present) return history;
  return {
    past: [...history.past, history.present].slice(-Math.max(1, capacity)),
    present,
    future: [],
  };
}

/** Restore the preceding immutable state, when one exists. */
export function undoHistory<T>(history: History<T>): History<T> {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

/** Restore the next undone state, when one exists. */
export function redoHistory<T>(history: History<T>): History<T> {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
