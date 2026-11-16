// Runs sandboxed with contextIsolation on. It exposes exactly the typed bridge
// and nothing else: no ipcRenderer, no Node.
import { contextBridge, ipcRenderer, webUtils } from "electron";
import { channels, type ElectronBridge } from "./bridge";
import { nativeChannels } from "../contracts/platform";

const MAX_FALLBACK_BYTES = 64 * 1024 ** 2;

const bridge: ElectronBridge = {
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
  cancelExport: () => ipcRenderer.invoke(nativeChannels.cancelExport),
  revealExport: () => ipcRenderer.invoke(nativeChannels.revealExport),
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
