import { isThemeChoice, type ThemeChoice } from "../../contracts/platform";

/**
 * The appearance choice is a per-device presentation preference: it lives in
 * this browser profile's storage and never in a project. It sits with the
 * other platform effects so components do not reach for storage themselves.
 */
const STORAGE_KEY = "corto.theme";

/** The saved choice, or "system" when nothing valid is stored or storage is refused. */
export function loadTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Sets the document theme; "system" defers to prefers-color-scheme. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = choice;
}

/** Applies the choice now and remembers it for the next launch. */
export function saveTheme(choice: ThemeChoice) {
  applyTheme(choice);
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* Private windows may refuse storage; the choice still applies now. */
  }
}
