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
  isThemeChoice,
  nativeChannels,
  windowFrameFor,
  type WindowFrame,
} from "../contracts/platform";
import { assertMainSender } from "./project-ipc";

/** Matches --titlebar in src/styles/tokens.css. */
export const TITLE_BAR_HEIGHT = 44;
/**
 * Title-bar canvas and caption-symbol colours: the miille desk (--base) and
 * secondary ink (--fg-2) from src/styles/tokens.css, so the caption buttons sit
 * on the same grey as the title bar and the library.
 */
const CHROME = {
  light: { color: "#f3f3f4", symbolColor: "#45454b", window: "#f3f3f4" },
  dark: { color: "#0b0b0c", symbolColor: "#c4c4ca", window: "#0b0b0c" },
} as const;

const chrome = () =>
  nativeTheme.shouldUseDarkColors ? CHROME.dark : CHROME.light;

/** Constructor options for the frame this platform uses. */
export function frameOptions(
  frame: WindowFrame = windowFrameFor(process.platform),
): BrowserWindowConstructorOptions {
  const colours = chrome();
  const base = { backgroundColor: colours.window };
  if (frame === "mac")
    return {
      ...base,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 15 },
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
    // The renderer is not trusted: refuse anything but a known choice rather
    // than hand an arbitrary value to Electron.
    if (!isThemeChoice(theme)) throw new Error("Unknown appearance");
    nativeTheme.themeSource = theme;
  });
  nativeTheme.on("updated", () => {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    const colours = chrome();
    window.setBackgroundColor(colours.window);
    if (windowFrameFor(process.platform) === "windows")
      window.setTitleBarOverlay({
        color: colours.color,
        symbolColor: colours.symbolColor,
        height: TITLE_BAR_HEIGHT,
      });
  });
}
