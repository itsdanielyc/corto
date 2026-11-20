import { THEME_CHOICES, type ThemeChoice } from "../../contracts/platform";

/** Per-device presentation preference; never part of a project. */
const STORAGE_KEY = "corto.theme";

export function loadTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEME_CHOICES.includes(stored as ThemeChoice)
      ? (stored as ThemeChoice)
      : "system";
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

export function saveTheme(choice: ThemeChoice) {
  applyTheme(choice);
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* Private windows may refuse storage; the choice still applies now. */
  }
}
