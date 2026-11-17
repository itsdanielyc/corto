import {
  app,
  desktopCapturer,
  dialog,
  session,
  type BrowserWindow,
} from "electron";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeChannels } from "../contracts/platform";
import type { FileProjectRepository } from "./storage";

/** Deliver OS-selected files as validated projects; native paths never cross the preload boundary. */
export function projectOpenIntegration(
  repository: () => FileProjectRepository | null,
  window: () => BrowserWindow | null,
): { rendererReady: () => void } {
  const pending: string[] = [];
  let ready = false;
  let processing = false;
  const drain = async () => {
    if (!ready || processing || !repository() || !window()) return;
    processing = true;
    try {
      while (pending.length) {
        const source = pending.shift()!;
        try {
          const project = await repository()!.importPortable(source);
          const target = window();
          if (target && !target.isDestroyed()) {
            target.webContents.send(nativeChannels.projectOpened, project);
            target.show();
            target.focus();
          }
        } catch (error) {
          const target = window();
          if (target)
            await dialog.showMessageBox(target, {
              type: "error",
              message: "This Corto file could not be opened.",
              detail:
                error instanceof Error
                  ? error.message
                  : "Choose a complete portable project.",
              buttons: ["OK"],
            });
        }
      }
    } finally {
      processing = false;
    }
  };
  const enqueue = (source: string) => {
    if (
      source.length > 32768 ||
      !/\.corto$/i.test(source) ||
      source.startsWith("-") ||
      pending.length >= 10
    )
      return;
    const path = source.startsWith("file:")
      ? fileURLToPath(source)
      : resolve(source);
    pending.push(path);
    void drain();
  };
  app.on("open-file", (event, path) => {
    event.preventDefault();
    enqueue(path);
  });
  app.on("second-instance", (_event, argv) => {
    for (const argument of argv) enqueue(argument);
    const target = window();
    if (target?.isMinimized()) target.restore();
    target?.focus();
  });
  for (const argument of process.argv.slice(1)) enqueue(argument);
  return {
    rendererReady: () => {
      ready = true;
      void drain();
    },
  };
}

/** Use the OS picker where available, with an explicit source chooser on other desktop systems. */
export function configureCapture(window: () => BrowserWindow | null): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (
        request.frame !== window()?.webContents.mainFrame ||
        !request.userGesture
      ) {
        callback(null);
        return;
      }
      void desktopCapturer
        .getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 0, height: 0 },
        })
        .then(async (sources) => {
          const target = window();
          if (!target || !sources.length) {
            callback(null);
            return;
          }
          const available = sources.slice(0, 12);
          const selection = await dialog.showMessageBox(target, {
            type: "question",
            title: "Choose what to record",
            message: "Choose a screen or window to record.",
            buttons: ["Cancel", ...available.map((source) => source.name)],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          });
          const source = available[selection.response - 1];
          if (!source) callback(null);
          else
            callback({
              video: source,
              ...(request.audioRequested && process.platform === "win32"
                ? { audio: "loopback" }
                : {}),
            });
        })
        .catch(() => callback(null));
    },
    { useSystemPicker: true },
  );
}
