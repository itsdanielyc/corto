// Runs sandboxed with contextIsolation on. It exposes exactly the typed bridge
// and nothing else: no ipcRenderer, no Node.
import { contextBridge, ipcRenderer, webUtils } from "electron";
import { channels, type ElectronBridge } from "./bridge";
import { nativeChannels } from "../contracts/platform";

const MAX_FALLBACK_BYTES = 64 * 1024 ** 2;

const bridge: ElectronBridge = {
  // Same mapping as electron/window-chrome.ts; the sandboxed preload cannot import Electron main APIs.
  windowFrame:
    process.platform === "darwin"
      ? "mac"
      : process.platform === "win32"
        ? "windows"
        : "system",
  setNativeTheme: (theme) =>
    ipcRenderer.invoke(nativeChannels.setNativeTheme, theme),
  platformInfo: () => ipcRenderer.invoke(channels.platformInfo),
  loadProject: () => ipcRenderer.invoke(nativeChannels.loadProject),
  listProjects: () => ipcRenderer.invoke(nativeChannels.listProjects),
  openProject: (id, recover) =>
    ipcRenderer.invoke(nativeChannels.openProject, id, recover),
  saveProject: (project) =>
    ipcRenderer.invoke(nativeChannels.saveProject, project),
  importPhoneVideo: (file) => {
    const path = webUtils.getPathForFile(file);
    if (!path)
      return Promise.reject(
        new Error("Choose this phone video from your device to import it"),
      );
    return ipcRenderer.invoke(nativeChannels.importPhoneVideo, path, file.name);
  },
  importMedia: async (file) => {
    const path = webUtils.getPathForFile(file);
    if (!path && file.size > MAX_FALLBACK_BYTES)
      throw new Error("This recording is too large; use a shorter take");
    return ipcRenderer.invoke(
      nativeChannels.importMedia,
      path || new Uint8Array(await file.arrayBuffer()),
      file.name,
    );
  },
  processMedia: (project, request) =>
    ipcRenderer.invoke(nativeChannels.processMedia, project, request),
  cancelMedia: () => ipcRenderer.invoke(nativeChannels.cancelMedia),
  audioSamples: (project, request) =>
    ipcRenderer.invoke(nativeChannels.audioSamples, project, request),
  putAsset: async (asset, file) => {
    const path = webUtils.getPathForFile(file);
    if (!path && file.size > MAX_FALLBACK_BYTES)
      throw new Error("Import this large original from your device");
    return ipcRenderer.invoke(
      nativeChannels.putAsset,
      asset,
      path || new Uint8Array(await file.arrayBuffer()),
    );
  },
  assetUrl: (id) => `corto-media://asset/${encodeURIComponent(id)}`,
  openPortable: () => ipcRenderer.invoke(nativeChannels.openPortable),
  savePortable: (project) =>
    ipcRenderer.invoke(nativeChannels.savePortable, project),
  exportMovie: (request) =>
    ipcRenderer.invoke(nativeChannels.exportMovie, request),
  chooseExportDestination: (project, sample) =>
    ipcRenderer.invoke(nativeChannels.chooseExportDestination, project, sample),
  releaseExportDestination: (token) =>
    ipcRenderer.invoke(nativeChannels.releaseExportDestination, token),
  beginRenderAssets: (project, resolution) =>
    ipcRenderer.invoke(nativeChannels.beginRenderAssets, project, resolution),
  stageRenderAsset: (token, raster) =>
    ipcRenderer.invoke(nativeChannels.stageRenderAsset, token, raster),
  releaseRenderAssets: (token) =>
    ipcRenderer.invoke(nativeChannels.releaseRenderAssets, token),
  cancelExport: () => ipcRenderer.invoke(nativeChannels.cancelExport),
  revealExport: () => ipcRenderer.invoke(nativeChannels.revealExport),
  projectAction: (request) =>
    ipcRenderer.invoke(nativeChannels.projectAction, request),
  listVersions: (id) => ipcRenderer.invoke(nativeChannels.listVersions, id),
  restoreVersion: (id, version) =>
    ipcRenderer.invoke(nativeChannels.restoreVersion, id, version),
  loadPreferences: () => ipcRenderer.invoke(nativeChannels.loadPreferences),
  savePreferences: (preferences) =>
    ipcRenderer.invoke(nativeChannels.savePreferences, preferences),
  checkForUpdate: () => ipcRenderer.invoke(nativeChannels.checkForUpdate),
  onProjectOpened: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      project: Parameters<typeof listener>[0],
    ) => listener(project);
    ipcRenderer.on(nativeChannels.projectOpened, handler);
    return () =>
      ipcRenderer.removeListener(nativeChannels.projectOpened, handler);
  },
  onExportProgress: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: Parameters<typeof listener>[0],
    ) => listener(progress);
    ipcRenderer.on(nativeChannels.exportProgress, handler);
    return () =>
      ipcRenderer.removeListener(nativeChannels.exportProgress, handler);
  },
};

contextBridge.exposeInMainWorld("electronBridge", bridge);
