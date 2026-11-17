import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { ExportProgress, MovieRequest } from "../contracts/platform";
import { EXPORT_FPS, parseProject } from "../contracts/project";
import { frameDimensions, sceneFrameCounts } from "../src/domain/timeline";
import type { FileProjectRepository } from "./storage";
import { writeAtomic } from "./atomic-file";
import { runFfmpeg } from "./ffmpeg-process";
import { sceneArguments } from "./movie-plan";
import {
  exportBitrate,
  EXPORT_PRESETS,
  sampleProject,
} from "../src/export/presets";
import { soundMixArguments } from "./movie-sound";
import { burnSubtitles } from "./movie-subtitles";
import { projectAudioClips } from "../src/domain/audio";
import { renderCreatorMovie, usesCreatorRenderer } from "./creator-renderer";
import type { RenderAssets } from "./render-assets";

const MAX_OVERLAY_BYTES = 4 * 1024 ** 2;
const MAX_TOTAL_OVERLAY_BYTES = 32 * 1024 ** 2;
const TEMPORARY_PREFIX = "corto-render-";

/** Check cheap PNG headers and output dimensions before asking a decoder to process a title layer. */
function validateOverlay(png: Uint8Array, width: number, height: number): void {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    !(png instanceof Uint8Array) ||
    png.byteLength < 24 ||
    png.byteLength > MAX_OVERLAY_BYTES ||
    signature.some((value, index) => png[index] !== value)
  )
    throw new Error("A title image could not be read");
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (header.getUint32(16) !== width || header.getUint32(20) !== height)
    throw new Error("A title image has the wrong movie dimensions");
}

/** An injected binary and repository keep actual video rendering testable outside Electron. */
export class MovieRenderer {
  constructor(
    private readonly binary: string,
    private readonly repository: FileProjectRepository,
    private readonly renderAssets?: RenderAssets,
  ) {}

  // Time O(encoded pixels + media bytes), space O(one scene's decoder/encoder buffers); scenes run sequentially.
  async render(
    request: MovieRequest,
    destination: string,
    signal: AbortSignal,
    progress: (value: ExportProgress) => void,
  ): Promise<void> {
    signal.throwIfAborted();
    if (usesCreatorRenderer(request))
      return renderCreatorMovie(
        this.binary,
        this.repository,
        request,
        destination,
        signal,
        progress,
        this.renderAssets,
      );
    if (
      request.preset !== undefined &&
      !Object.hasOwn(EXPORT_PRESETS, request.preset)
    )
      throw new Error("Choose a supported sharing preset");
    if (request.sample !== undefined && typeof request.sample !== "boolean")
      throw new Error("Invalid sample request");
    const project = sampleProject(
      parseProject(request.project),
      request.sample,
    );
    if (!project.scenes.length)
      throw new Error("Add at least one scene before exporting");
    if (!["720p", "1080p"].includes(request.resolution))
      throw new Error("Choose HD or Full HD export quality");
    if (
      !Array.isArray(request.overlays) ||
      request.overlays.length > project.scenes.length
    )
      throw new Error("Invalid title layers");
    const dimensions = frameDimensions(project.ratio, request.resolution);
    const bitrate = exportBitrate(request);
    const subtitleOverlays = request.subtitleOverlays ?? [];
    if (
      !Array.isArray(subtitleOverlays) ||
      subtitleOverlays.length > project.subtitles.length + 1
    )
      throw new Error("Invalid subtitle layers");
    let subtitleBytes = 0;
    const subtitleIds = new Set<string>();
    for (const overlay of subtitleOverlays) {
      if (
        !overlay ||
        typeof overlay.cueId !== "string" ||
        (overlay.cueId !== "" &&
          !project.subtitles.some((cue) => cue.id === overlay.cueId)) ||
        subtitleIds.has(overlay.cueId)
      )
        throw new Error("A subtitle layer does not match the film");
      validateOverlay(overlay.png, dimensions.width, dimensions.height);
      subtitleIds.add(overlay.cueId);
      subtitleBytes += overlay.png.byteLength;
      if (subtitleBytes > MAX_TOTAL_OVERLAY_BYTES)
        throw new Error("The subtitle layers exceed the movie memory budget");
    }
    if (
      project.subtitles.some(
        (cue) =>
          cue.start <
            project.scenes.reduce((sum, scene) => sum + scene.duration, 0) &&
          (!subtitleIds.has(cue.id) || !subtitleIds.has("")),
      )
    )
      throw new Error("A timed subtitle layer is missing");
    const overlayMap = new Map<string, Uint8Array>();
    let overlayBytes = 0;
    for (const overlay of request.overlays) {
      if (
        !project.scenes.some(
          (scene) => scene.id === overlay.sceneId && scene.caption.trim(),
        ) ||
        overlayMap.has(overlay.sceneId)
      )
        throw new Error("A title layer does not match the film");
      validateOverlay(overlay.png, dimensions.width, dimensions.height);
      overlayBytes += overlay.png.byteLength;
      if (overlayBytes > MAX_TOTAL_OVERLAY_BYTES)
        throw new Error("The title layers exceed the movie memory budget");
      overlayMap.set(overlay.sceneId, overlay.png);
    }
    if (
      project.scenes.some(
        (scene) => scene.caption.trim() && !overlayMap.has(scene.id),
      )
    )
      throw new Error(
        "A title could not be rendered. Reopen the export window and try again.",
      );
    const directory = await mkdtemp(join(tmpdir(), TEMPORARY_PREFIX));
    const paths: string[] = [];
    const audioCache = new Map<string, boolean>();
    const frameCounts = sceneFrameCounts(project.scenes);
    const total =
      frameCounts.reduce((sum, count) => sum + count, 0) / EXPORT_FPS;
    let completed = 0;
    try {
      for (let index = 0; index < project.scenes.length; index++) {
        signal.throwIfAborted();
        const scene = {
          ...project.scenes[index],
          duration: frameCounts[index] / EXPORT_FPS,
        };
        const asset = scene.assetId ? project.assets[scene.assetId] : null;
        const source = asset ? this.repository.assetPath(asset.id) : null;
        if (asset && source && (await stat(source)).size !== asset.size)
          throw new Error(`Original media is incomplete: ${asset.name}`);
        let hasAudio = false;
        if (asset?.kind === "video" && scene.volume > 0 && source) {
          if (!audioCache.has(asset.id)) {
            const diagnostic = await runFfmpeg(
              this.binary,
              [
                "-loglevel",
                "info",
                "-protocol_whitelist",
                "file,pipe",
                "-i",
                source,
              ],
              { signal, allowFailure: true },
            );
            audioCache.set(asset.id, /Stream #.*Audio:/.test(diagnostic));
          }
          hasAudio = audioCache.get(asset.id)!;
        }
        const output = join(
          directory,
          `scene-${String(index).padStart(4, "0")}.mp4`,
        );
        const layer = overlayMap.get(scene.id);
        const overlay = layer ? join(directory, `title-${index}.png`) : null;
        if (overlay && layer) await writeFile(overlay, layer);
        const input = {
          scene,
          frames: frameCounts[index],
          asset,
          source,
          overlay,
          output,
          ...dimensions,
          hasAudio,
          videoBitrate: bitrate,
        };
        await runFfmpeg(this.binary, sceneArguments(input), {
          signal,
          onSeconds: (seconds) =>
            progress({
              fraction: Math.max(
                0,
                Math.min(
                  0.85,
                  ((completed + Math.min(scene.duration, seconds)) / total) *
                    0.85,
                ),
              ),
              message: `Rendering scene ${index + 1} of ${project.scenes.length}`,
            }),
        });
        paths.push(output);
        completed += scene.duration;
      }
      signal.throwIfAborted();
      progress({ fraction: 0.87, message: "Putting your story together" });
      const manifest = join(directory, "scenes.txt");
      await writeFile(
        manifest,
        paths.map((path) => `file '${basename(path)}'`).join("\n"),
      );
      const joined = join(directory, "joined.mp4");
      await runFfmpeg(
        this.binary,
        [
          "-f",
          "concat",
          "-safe",
          "1",
          "-protocol_whitelist",
          "file,pipe",
          "-i",
          manifest,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          joined,
        ],
        { signal },
      );
      for (const path of paths) await rm(path);
      let finished = await burnSubtitles(
        this.binary,
        project,
        subtitleOverlays,
        joined,
        directory,
        total,
        bitrate,
        signal,
      );
      const trimmedLoops = new Map<string, string>();
      for (const [index, clip] of projectAudioClips(project).entries()) {
        if (clip.start >= total) continue;
        const asset = project.assets[clip.assetId];
        const source = this.repository.assetPath(asset.id);
        if ((await stat(source)).size !== asset.size)
          throw new Error(`Audio is missing or incomplete: ${asset.name}`);
        if (
          clip.loop &&
          clip.offset > 0 &&
          clip.duration > asset.duration - clip.offset
        ) {
          const trimmed = join(directory, `loop-source-${index}.wav`);
          await runFfmpeg(
            this.binary,
            [
              "-ss",
              String(clip.offset),
              "-protocol_whitelist",
              "file,pipe",
              "-i",
              source,
              "-vn",
              "-t",
              String(asset.duration - clip.offset),
              "-ac",
              "2",
              "-ar",
              "48000",
              "-c:a",
              "pcm_s16le",
              trimmed,
            ],
            { signal },
          );
          trimmedLoops.set(clip.id, trimmed);
        }
      }
      const soundOutput = join(directory, "finished.mp4");
      const mixArguments = soundMixArguments(
        project,
        this.repository,
        finished,
        soundOutput,
        total,
        trimmedLoops,
      );
      if (mixArguments) {
        progress({ fraction: 0.93, message: "Mixing music and narration" });
        await runFfmpeg(this.binary, mixArguments, { signal });
        finished = soundOutput;
      }
      signal.throwIfAborted();
      progress({ fraction: 0.98, message: "Saving your movie" });
      await writeAtomic(destination, (temporary) =>
        copyFile(finished, temporary),
      );
      progress({ fraction: 1, message: "Your movie is ready" });
    } finally {
      const absolute = resolve(directory);
      const fromTemporaryRoot = relative(resolve(tmpdir()), absolute);
      if (
        !fromTemporaryRoot.startsWith("..") &&
        !fromTemporaryRoot.includes(":") &&
        basename(absolute).startsWith(TEMPORARY_PREFIX)
      )
        await rm(absolute, { recursive: true, force: true });
    }
  }
}
