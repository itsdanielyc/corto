// The main process: the "backend" of this app, the way Rust is in the Tauri
// template. It answers the bridge's IPC calls. The greeting is implemented
// here on its own, not imported from contracts/, so the real-shell suite
// (tests/e2e) is what holds it to the contract.
import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { channels, type PlatformInfo } from "./bridge";
import { FileProjectRepository } from "./storage";
import { registerProjectCommands, testPreset } from "./project-ipc";
import { handleMediaRequests, registerMediaScheme } from "./media-protocol";

registerMediaScheme();
let mainWindow: BrowserWindow | null = null;

function greet(name: string): string {
  return `Hello, ${name}! You've been greeted from the main process!`;
}

function platformInfo(): PlatformInfo {
  return {
    os: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    packaged: app.isPackaged,
  };
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1024,
    height: 700,
    title: "Corto",
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;
  win.on("closed", () => { if (mainWindow === win) mainWindow = null; });
  win.webContents.on("will-navigate", event => event.preventDefault());
  win.once("ready-to-show", () => win.show());
  win.webContents.once("did-finish-load", () => {
    // Installer tests identify the actual loaded app, independent of AppImage's temporary mount name.
    const output = process.env.CORTO_SMOKE_OUTPUT;
    if (app.commandLine.hasSwitch("corto-smoke-test") && output) {
      void writeFile(output, JSON.stringify({ pid: process.pid, executable: app.getPath("exe"), rendererReady: true }));
    }
  });
  // Links open in the system browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  const repository = new FileProjectRepository(testPreset("CORTO_WORKSPACE_ROOT") ?? join(app.getPath("userData"), "workspace-v1"));
  handleMediaRequests(repository);
  registerProjectCommands(repository, () => mainWindow);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ipcMain.handle(channels.greet, (_e, name: unknown) => greet(String(name)));
  ipcMain.handle(channels.platformInfo, () => platformInfo());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
