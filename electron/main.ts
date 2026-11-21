import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { channels, type PlatformInfo } from "./bridge";
import { FileProjectRepository } from "./storage";
import { registerProjectCommands, testPreset } from "./project-ipc";
import { handleMediaRequests, registerMediaScheme } from "./media-protocol";
import { registerExportCommands } from "./export-ipc";
import { writeAtomic } from "./atomic-file";
import { configureCapture, projectOpenIntegration } from "./shell-integration";
import { frameOptions, registerWindowChrome } from "./window-chrome";

const testingWorkspace = testPreset("CORTO_WORKSPACE_ROOT");
if (testingWorkspace) {
  const profile = join(testingWorkspace, "runtime-profile");
  mkdirSync(profile, { recursive: true });
  app.setPath("userData", profile);
}
registerMediaScheme();
let mainWindow: BrowserWindow | null = null;
let nativeExporter: ReturnType<typeof registerExportCommands> | null = null;
let nativeMediaJobs: ReturnType<typeof registerProjectCommands> | null = null;
let readinessReported = false;
let repositoryForOpen: FileProjectRepository | null = null;
const projectFiles = projectOpenIntegration(
  () => repositoryForOpen,
  () => mainWindow,
);
if (process.env.CORTO_E2E !== "1" && !app.requestSingleInstanceLock())
  app.exit(0);

function reportInstallerReadiness(): void {
  const output = process.env.CORTO_SMOKE_OUTPUT;
  if (
    !app.commandLine.hasSwitch("corto-smoke-test") ||
    !output ||
    readinessReported ||
    !nativeExporter
  )
    return;
  readinessReported = true;
  const report = {
    pid: process.pid,
    executable: app.getPath("exe"),
    rendererReady: true,
    movieEncoded: false,
  };
  void nativeExporter
    .smokeEncoder()
    .then(() =>
      writeAtomic(output, (temporary) =>
        writeFile(
          temporary,
          JSON.stringify({ ...report, movieEncoded: true }),
          { flag: "wx" },
        ),
      ),
    )
    .catch((error) =>
      writeAtomic(output, (temporary) =>
        writeFile(
          temporary,
          JSON.stringify({ ...report, error: String(error) }),
          { flag: "wx" },
        ),
      ),
    );
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
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: "Corto",
    icon: join(import.meta.dirname, "../renderer/icon-512.png"),
    // A themed window can be shown even before a cold compositor paints it.
    show: true,
    ...frameOptions(),
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  let confirmingClose = false;
  win.on("close", (event) => {
    if (!nativeExporter?.active() && !nativeMediaJobs?.active()) return;
    event.preventDefault();
    if (confirmingClose) return;
    confirmingClose = true;
    void dialog
      .showMessageBox(win, {
        type: "question",
        message: "Corto is still processing your film.",
        detail: "Cancel the current operation and close Corto?",
        buttons: ["Keep processing", "Cancel and close"],
        defaultId: 0,
        cancelId: 0,
      })
      .then(async (result) => {
        confirmingClose = false;
        if (result.response === 1) {
          await nativeExporter?.cancelAndWait();
          await nativeMediaJobs?.cancelAndWait();
          win.destroy();
        }
      });
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
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
  const repository = new FileProjectRepository(
    testPreset("CORTO_WORKSPACE_ROOT") ??
      join(app.getPath("userData"), "workspace-v1"),
  );
  repositoryForOpen = repository;
  handleMediaRequests(repository);
  const mediaJobs = registerProjectCommands(
    repository,
    () => mainWindow,
    () => {
      reportInstallerReadiness();
      projectFiles.rendererReady();
    },
  );
  nativeMediaJobs = mediaJobs;
  const exporter = registerExportCommands(repository, () => mainWindow);
  nativeExporter = exporter;
  app.on("before-quit", (event) => {
    if (!exporter.active() && !mediaJobs.active()) return;
    event.preventDefault();
    void Promise.all([
      exporter.cancelAndWait(),
      mediaJobs.cancelAndWait(),
    ]).finally(() => app.quit());
  });
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) =>
      callback(
        contents === mainWindow?.webContents &&
          permission === "media" &&
          "mediaTypes" in details &&
          !!details.mediaTypes?.length &&
          details.mediaTypes.every(
            (type) => type === "audio" || type === "video",
          ),
      ),
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, _origin, details) =>
      contents === mainWindow?.webContents &&
      permission === "media" &&
      (details.mediaType === "audio" || details.mediaType === "video"),
  );
  configureCapture(() => mainWindow);
  ipcMain.handle(channels.platformInfo, () => platformInfo());
  registerWindowChrome(() => mainWindow);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
