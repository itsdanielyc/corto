import { app, dialog, ipcMain, shell, type BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { nativeChannels, type MovieRequest } from "../contracts/platform";
import { parseProject } from "../contracts/project";
import type { FileProjectRepository } from "./storage";
import { MovieRenderer } from "./movie-renderer";
import { assertMainSender, testPreset } from "./project-ipc";
import { appendScene, createProject, createScene } from "../src/domain/project";
import { RenderAssets } from "./render-assets";
import type { RenderRaster } from "../contracts/services";
import { resolutionSchema } from "../contracts/values";

/** Own one export job and keep native save/reveal paths out of renderer-controlled data. */
export function registerExportCommands(
  repository: FileProjectRepository,
  getWindow: () => BrowserWindow | null,
): {
  active: () => boolean;
  cancelAndWait: () => Promise<void>;
  smokeEncoder: () => Promise<void>;
} {
  const binary = app.isPackaged
    ? join(
        process.resourcesPath,
        "ffmpeg",
        process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
      )
    : (createRequire(import.meta.url)("ffmpeg-static") as string);
  if (!binary) throw new Error("FFmpeg is not available for this platform");
  const rasters = new RenderAssets();
  const renderer = new MovieRenderer(binary, repository, rasters);
  ipcMain.handle(
    nativeChannels.beginRenderAssets,
    (event, project, resolution) => {
      assertMainSender(event, getWindow());
      return rasters.begin(
        parseProject(project),
        resolutionSchema.parse(resolution),
      );
    },
  );
  ipcMain.handle(
    nativeChannels.stageRenderAsset,
    (event, token: unknown, raster: RenderRaster) => {
      assertMainSender(event, getWindow());
      if (typeof token !== "string") throw new Error("Invalid export token");
      return rasters.stage(token, raster);
    },
  );
  ipcMain.handle(
    nativeChannels.releaseRenderAssets,
    (event, token: unknown) => {
      assertMainSender(event, getWindow());
      if (typeof token !== "string") throw new Error("Invalid export token");
      return rasters.release(token);
    },
  );
  let job: { controller: AbortController; finished: Promise<void> } | null =
    null;
  let lastExport: string | null = null;
  ipcMain.handle(nativeChannels.exportMovie, async (event, input: unknown) => {
    const window = getWindow();
    assertMainSender(event, window);
    if (!window) return null;
    if (job) throw new Error("A movie is already being exported");
    if (
      !input ||
      typeof input !== "object" ||
      !("project" in input) ||
      !("resolution" in input) ||
      !("overlays" in input)
    )
      throw new Error("The movie request is incomplete");
    const project = parseProject(input.project);
    const extension = project.output.format;
    const name =
      project.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim() ||
      "Corto film";
    const destination =
      testPreset("CORTO_EXPORT_PATH") ??
      (
        await dialog.showSaveDialog(window, {
          title: "Export your movie",
          defaultPath: join(
            app.getPath("videos"),
            `${name}${"sample" in input && input.sample === true ? "-sample" : ""}.${extension}`,
          ),
          filters: [
            {
              name: `${extension.toUpperCase()} export`,
              extensions: [extension],
            },
          ],
        })
      ).filePath;
    if (!destination) return null;
    const controller = new AbortController();
    const finished = renderer.render(
      {
        project,
        resolution: input.resolution,
        overlays: input.overlays,
        subtitleOverlays:
          "subtitleOverlays" in input ? input.subtitleOverlays : undefined,
        preset: "preset" in input ? input.preset : undefined,
        sample: "sample" in input ? input.sample : undefined,
        range: "range" in input ? input.range : undefined,
        renderAssetsToken:
          "renderAssetsToken" in input ? input.renderAssetsToken : undefined,
      } as MovieRequest,
      destination,
      controller.signal,
      (progress) => {
        if (!window.isDestroyed() && !window.webContents.isDestroyed())
          window.webContents.send(nativeChannels.exportProgress, progress);
      },
    );
    job = { controller, finished };
    try {
      await finished;
      lastExport = destination;
      return {
        fileName: basename(destination),
        format: extension.toUpperCase(),
        location: "file",
      };
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Export cancelled");
      console.error("Corto native export failed:", error);
      throw new Error(
        "Corto could not finish this movie. Check that the media plays in preview and the destination has enough free space, then try again.",
      );
    } finally {
      job = null;
    }
  });
  ipcMain.handle(nativeChannels.cancelExport, (event) => {
    assertMainSender(event, getWindow());
    job?.controller.abort();
  });
  ipcMain.handle(nativeChannels.revealExport, (event) => {
    assertMainSender(event, getWindow());
    if (lastExport) shell.showItemInFolder(lastExport);
  });
  return {
    smokeEncoder: async () => {
      const directory = await mkdtemp(join(tmpdir(), "corto-installed-smoke-"));
      try {
        const project = appendScene(createProject("Installer verification"), {
          ...createScene(null),
          caption: "",
          duration: 0.25,
        });
        const output = join(directory, "encoder.mp4");
        await renderer.render(
          { project, resolution: "720p", overlays: [] },
          output,
          new AbortController().signal,
          () => undefined,
        );
        const bytes = await readFile(output);
        if (bytes.subarray(4, 8).toString() !== "ftyp")
          throw new Error("The bundled encoder did not produce an MP4");
      } finally {
        if (basename(directory).startsWith("corto-installed-smoke-"))
          await rm(directory, { recursive: true, force: true });
      }
    },
    active: () => job !== null,
    cancelAndWait: async () => {
      const current = job;
      current?.controller.abort();
      await current?.finished.catch(() => undefined);
      await rasters.dispose();
    },
  };
}
