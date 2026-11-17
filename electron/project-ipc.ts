import {
  app,
  dialog,
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
} from "electron";
import { join } from "node:path";
import { createRequire } from "node:module";
import { nativeChannels } from "../contracts/platform";
import {
  identifierSchema,
  mediaAssetSchema,
  parseProject,
} from "../contracts/project";
import type { FileProjectRepository } from "./storage";
import { importPhoneVideo } from "./phone-import";
import { importNativeSelection, processNativeMedia } from "./media-jobs";
import { mediaOperationSchema } from "../contracts/services";
import { z } from "zod";
import { preferencesSchema } from "../contracts/creative";
import { checkPublishedUpdate } from "../src/platform/updates";
import { nativeAudioSamples } from "./audio-samples";

const MAX_FALLBACK_BYTES = 64 * 1024 ** 2;

function safeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() || "Corto film";
}

/** Native dialog presets are enabled only for explicit, unpackaged automated test runs. */
export function testPreset(name: string): string | undefined {
  return !app.isPackaged && process.env.CORTO_E2E === "1"
    ? process.env[name]
    : undefined;
}

/** Restrict every native command to the application's own top-level renderer. */
export function assertMainSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow | null,
): void {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== event.sender.mainFrame
  )
    throw new Error("This native operation is not available to that frame");
}

/** Wire project operations; no renderer-controlled output path crosses this boundary. */
export function registerProjectCommands(
  repository: FileProjectRepository,
  getWindow: () => BrowserWindow | null,
  onRendererReady: () => void = () => undefined,
): void {
  const handle = (
    channel: string,
    operation: (...arguments_: unknown[]) => unknown,
  ) => {
    ipcMain.handle(channel, (event, ...arguments_: unknown[]) => {
      assertMainSender(event, getWindow());
      return operation(...arguments_);
    });
  };
  handle(nativeChannels.loadProject, () => {
    onRendererReady();
    return repository.loadProject();
  });
  handle(nativeChannels.saveProject, (input) =>
    repository.saveProject(parseProject(input)),
  );
  handle(nativeChannels.listProjects, () => repository.listProjects());
  handle(nativeChannels.openProject, (id, recover) => {
    if (recover !== undefined && typeof recover !== "boolean")
      throw new Error("Invalid recovery request");
    return repository.openProject(identifierSchema.parse(id), recover === true);
  });
  const projectActionSchema = z.discriminatedUnion("operation", [
    z.strictObject({
      operation: z.literal("rename"),
      id: identifierSchema,
      name: z.string().trim().min(1).max(80),
    }),
    z.strictObject({
      operation: z.enum(["duplicate", "delete"]),
      id: identifierSchema,
    }),
  ]);
  handle(nativeChannels.projectAction, (request) =>
    repository.projectAction(projectActionSchema.parse(request)),
  );
  handle(nativeChannels.listVersions, (id) =>
    repository.listVersions(identifierSchema.parse(id)),
  );
  handle(nativeChannels.restoreVersion, (id, version) =>
    repository.restoreVersion(
      identifierSchema.parse(id),
      identifierSchema.parse(version),
    ),
  );
  handle(nativeChannels.loadPreferences, () => repository.loadPreferences());
  handle(nativeChannels.savePreferences, (preferences) =>
    repository.savePreferences(preferencesSchema.parse(preferences)),
  );
  handle(nativeChannels.checkForUpdate, () =>
    checkPublishedUpdate(app.getVersion()),
  );
  const binary = app.isPackaged
    ? join(
        process.resourcesPath,
        "ffmpeg",
        process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
      )
    : (createRequire(import.meta.url)("ffmpeg-static") as string);
  handle(nativeChannels.audioSamples, (project, request) => nativeAudioSamples(binary, repository, parseProject(project), request));
  let mediaJob: AbortController | null = null;
  handle(nativeChannels.cancelMedia, () => mediaJob?.abort());
  handle(nativeChannels.importMedia, async (source, name) => {
    if (
      !(
        (typeof source === "string" && source.length < 32768) ||
        (source instanceof Uint8Array && source.length <= MAX_FALLBACK_BYTES)
      ) ||
      typeof name !== "string" ||
      name.length > 255
    )
      throw new Error("Invalid media selection");
    if (mediaJob) throw new Error("Finish the current media operation first");
    const controller = new AbortController();
    mediaJob = controller;
    try {
      return await importNativeSelection(
        binary,
        repository,
        source as string | Uint8Array,
        name,
        controller.signal,
      );
    } finally {
      mediaJob = null;
    }
  });
  handle(nativeChannels.processMedia, async (project, request) => {
    if (mediaJob) throw new Error("Finish the current media operation first");
    const controller = new AbortController();
    mediaJob = controller;
    try {
      return await processNativeMedia(
        binary,
        repository,
        parseProject(project),
        mediaOperationSchema.parse(request),
        controller.signal,
      );
    } finally {
      mediaJob = null;
    }
  });
  let importingPhone = false;
  handle(nativeChannels.importPhoneVideo, async (source, name) => {
    if (
      typeof source !== "string" ||
      source.length > 32768 ||
      typeof name !== "string" ||
      name.length > 255
    )
      throw new Error("Invalid phone video selection");
    if (importingPhone)
      throw new Error("A phone video is already being prepared");
    const binary = app.isPackaged
      ? join(
          process.resourcesPath,
          "ffmpeg",
          process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
        )
      : (createRequire(import.meta.url)("ffmpeg-static") as string);
    importingPhone = true;
    try {
      return await importPhoneVideo(binary, repository, source, name);
    } finally {
      importingPhone = false;
    }
  });
  handle(nativeChannels.putAsset, async (input, source) => {
    const asset = mediaAssetSchema.parse(input);
    if (
      typeof source === "string" &&
      source.length > 0 &&
      source.length < 32768
    )
      return repository.putAsset(asset, source);
    if (source instanceof Uint8Array && source.byteLength <= MAX_FALLBACK_BYTES)
      return repository.putAsset(asset, source);
    throw new Error(
      "Choose this original media file from your device to import it",
    );
  });
  handle(nativeChannels.savePortable, async (input) => {
    const project = parseProject(input);
    const window = getWindow();
    if (!window) return false;
    const preset = testPreset("CORTO_PROJECT_PATH");
    const destination =
      preset ??
      (
        await dialog.showSaveDialog(window, {
          title: "Save a portable Corto project",
          defaultPath: join(
            app.getPath("documents"),
            `${safeName(project.name)}.corto`,
          ),
          filters: [{ name: "Corto project", extensions: ["corto"] }],
        })
      ).filePath;
    if (!destination) return false;
    await repository.exportPortable(project, destination);
    return true;
  });
  handle(nativeChannels.openPortable, async () => {
    const window = getWindow();
    if (!window) return null;
    const preset = testPreset("CORTO_PROJECT_PATH");
    const source =
      preset ??
      (
        await dialog.showOpenDialog(window, {
          title: "Open a Corto project",
          properties: ["openFile"],
          filters: [{ name: "Corto project", extensions: ["corto"] }],
        })
      ).filePaths[0];
    return source ? repository.importPortable(source) : null;
  });
}
