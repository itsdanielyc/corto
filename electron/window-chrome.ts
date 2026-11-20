// Window frame per platform: macOS keeps its traffic lights inset in Corto's
// title bar, Windows overlays its caption buttons on it, Linux keeps the
// system frame (client-side decorations differ by compositor). The renderer
// leaves room according to the same WindowFrame value the preload reports.
import {
  BrowserWindow,
  ipcMain,
  nativeTheme,
  type BrowserWindowConstructorOptions,
} from "electron";
import {
  nativeChannels,
  THEME_CHOICES,
  type ThemeChoice,
  type WindowFrame,
} from "../contracts/platform";
import { assertMainSender } from "./project-ipc";

/** Matches --titlebar in src/styles/tokens.css. */
export const TITLE_BAR_HEIGHT = 48;
/** Title-bar canvas and caption-symbol colours from the design tokens. */
const CHROME = {
  light: { color: "#f4f4f5", symbolColor: "#3f3f46", window: "#f4f4f5" },
  dark: { color: "#0e0e10", symbolColor: "#bcbcc3", window: "#0e0e10" },
} as const;

export function windowFrame(
  platform: NodeJS.Platform = process.platform,
): WindowFrame {
  if (platform === "darwin") return "mac";
  if (platform === "win32") return "windows";
  return "system";
}

const chrome = () =>
  nativeTheme.shouldUseDarkColors ? CHROME.dark : CHROME.light;

/** Constructor options for the frame this platform uses. */
export function frameOptions(
  frame: WindowFrame = windowFrame(),
): BrowserWindowConstructorOptions {
  const colours = chrome();
  const base = { backgroundColor: colours.window };
  if (frame === "mac")
    return {
      ...base,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 18, y: 16 },
    };
  if (frame === "windows")
    return {
      ...base,
      titleBarStyle: "hidden",
      titleBarOverlay: {
        color: colours.color,
        symbolColor: colours.symbolColor,
        height: TITLE_BAR_HEIGHT,
      },
    };
  return base;
}

/** Appearance choice from Settings; caption buttons follow the resulting theme. */
export function registerWindowChrome(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(nativeChannels.setNativeTheme, (event, theme: unknown) => {
    assertMainSender(event, getWindow());
    if (!THEME_CHOICES.includes(theme as ThemeChoice))
      throw new Error("Unknown appearance");
    nativeTheme.themeSource = theme as ThemeChoice;
  });
  nativeTheme.on("updated", () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    const colours = chrome();
    window.setBackgroundColor(colours.window);
    if (windowFrame() === "windows")
      window.setTitleBarOverlay({
        color: colours.color,
        symbolColor: colours.symbolColor,
        height: TITLE_BAR_HEIGHT,
      });
  });
}
