import { gifPaletteArguments, gifMovieArguments } from "../src/export/gif";
import { transitionArguments } from "../src/export/ffmpeg-transition";
import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { ExportProgress, MovieRequest } from "../contracts/platform";
import { parseProject, type Project } from "../contracts/project";
import { frameDimensions } from "../src/domain/timeline";
import {
  outputFrameRate,
  planRenderSegments,
  resolveRenderRange,
} from "../src/domain/render-plan";
import { exportBitrate } from "../src/export/presets";
import { projectAudioClips } from "../src/domain/audio";
import type { FileProjectRepository } from "./storage";
import {
  type RenderAssets,
  type StagedRaster,
  validateRaster,
} from "./render-assets";
import { chooseEncoder, rejectHardwareEncoder } from "./encoder";
import { withEncoderFallback } from "./encoder-recovery";
import { creatorSceneArguments } from "./creator-scene";
import { runFfmpeg } from "./ffmpeg-process";
import { writeAtomic } from "./atomic-file";
import { burnSubtitles } from "./movie-subtitles";
import { soundMixArguments } from "./movie-sound";
import { rasterKeys, scopedRasterProject } from "../src/export/raster-scope";

const PREFIX = "corto-compose-";

/** Keep the proven legacy path available for old bridge clients while new exports use composition segments. */
export function usesCreatorRenderer(request: MovieRequest): boolean {
  return (
    !!request.renderAssetsToken ||
    !!request.range ||
    request.resolution === "2160p" ||
    request.project.output.fps !== 30 ||
    request.project.output.format !== "mp4" ||
    request.project.scenes.some(
      (scene) =>
        scene.textItems.length ||
        scene.layers.length ||
        !["cut", "fade"].includes(scene.transition) ||
        scene.speed !== 1 ||
        scene.loop ||
        scene.audioFadeIn ||
        scene.audioFadeOut ||
        scene.transform.rotation ||
        scene.transform.flipX ||
        scene.transform.flipY ||
        scene.transform.motion !== "none" ||
        scene.transform.zoom !== 1 ||
        scene.transform.focusX !== 0.5 ||
        scene.transform.focusY !== 0.5 ||
        scene.backdrop.kind !== "solid" ||
        scene.adjustments.look !== "none" ||
        scene.adjustments.brightness ||
        scene.adjustments.contrast ||
        scene.adjustments.saturation ||
        scene.adjustments.warmth ||
        scene.adjustments.lutAssetId ||
        scene.keyColour,
    )
  );
}

// Time O(encoded pixels + media bytes), space O(one body or adjacent overlap + staged rasters on disk).
/** Render bounded immutable segments; no repeatedly encoded movie prefix or all-scenes filter graph. */
export async function renderCreatorMovie(
  binary: string,
  repository: FileProjectRepository,
  request: MovieRequest,
  destination: string,
  signal: AbortSignal,
  progress: (value: ExportProgress) => void,
  cache?: RenderAssets,
): Promise<void> {
  const project = parseProject(request.project);
  const audioOnly = ["m4a", "wav"].includes(project.output.format);
  const partExtension = audioOnly ? "wav" : "mp4";
  const range = resolveRenderRange(project, request.range, request.sample);
  const fps = outputFrameRate(project);
  const dimensions = frameDimensions(project.ratio, request.resolution);
  const segments = planRenderSegments(project.scenes, fps, range);
  const directory = await mkdtemp(join(tmpdir(), PREFIX));
  const total =
    segments.reduce((sum, segment) => sum + segment.frames, 0) / fps;
  if (!segments.length) throw new Error("Add a scene to export");
  const scoped = scopedRasterProject({ ...request, project });
  const required = audioOnly ? new Set<string>() : rasterKeys(scoped);
  try {
    const rasters = new Map<string, StagedRaster>(
      request.renderAssetsToken
        ? (cache?.resolve(
            request.renderAssetsToken,
            project,
            request.resolution,
            required,
          ) ??
            (() => {
              throw new Error("The render assets are unavailable");
            })())
        : [],
    );
    for (const overlay of request.overlays) {
      if (
        !project.scenes.some(
          (scene) => scene.id === overlay.sceneId && scene.caption.trim(),
        )
      )
        throw new Error("A title layer does not belong to this film");
      validateRaster({ ...dimensions, key: overlay.sceneId, png: overlay.png });
      const path = join(directory, `legacy-${rasters.size}.png`);
      await writeFile(path, overlay.png);
      rasters.set(`caption:${overlay.sceneId}`, { path, ...dimensions });
    }
    for (const key of required)
      if (!key.startsWith("subtitle:") && !rasters.has(key))
        throw new Error(
          "An export title or overlay is missing. Reopen the export window and try again.",
        );
    const audio = new Set<string>();
    const used = new Set(
      scoped.scenes
        .flatMap((scene) => [
          scene.assetId,
          scene.backdrop.assetId,
          ...scene.layers.map((layer) => layer.assetId),
        ])
        .filter((id): id is string => !!id),
    );
    for (const id of used) {
      signal.throwIfAborted();
      const asset = project.assets[id];
      if (audioOnly && (asset.kind !== "video" || asset.hasAudio === false))
        continue;
      const path = repository.assetPath(id);
      if ((await stat(path)).size !== asset.size)
        throw new Error(`Original media is incomplete: ${asset.name}`);
      if (asset.kind === "video" && project.output.format !== "gif") {
        const diagnostic = await runFfmpeg(
          binary,
          ["-loglevel", "info", "-i", path],
          { signal, allowFailure: true },
        );
        if (/Stream #.*Audio:/.test(diagnostic)) audio.add(id);
      }
    }
    const encoder = audioOnly
      ? { name: "libx264", threads: 1, quality: project.output.quality }
      : await chooseEncoder(binary, project.output, signal);
    progress({
      fraction: 0,
      message: `Rendering with ${encoder.name === "libx264" ? "software" : "hardware"} encoding`,
    });
    const bitrate = Math.round(
      exportBitrate(request) *
        (request.resolution === "2160p" ? 4 : 1) *
        (0.35 + project.output.quality / 100),
    );
    const files: string[] = [];
    const lutFiles = new Map<string, string>();
    for (const scene of audioOnly ? [] : scoped.scenes)
      if (
        scene.adjustments.lutAssetId &&
        !lutFiles.has(scene.adjustments.lutAssetId)
      ) {
        const lutName = `look-${lutFiles.size}.cube`;
        await copyFile(
          repository.assetPath(scene.adjustments.lutAssetId),
          join(directory, lutName),
        );
        lutFiles.set(scene.adjustments.lutAssetId, lutName);
      }
    let completed = 0;
    const encode = <T>(operation: () => Promise<T>) =>
      withEncoderFallback(
        encoder,
        signal,
        () => {
          rejectHardwareEncoder(binary);
          progress({
            fraction: Math.min(0.85, (completed / total) * 0.85),
            message:
              "Using software encoding after the hardware became unavailable",
          });
        },
        operation,
      );
    for (const [index, segment] of segments.entries()) {
      signal.throwIfAborted();
      const output = join(
        directory,
        `part-${String(index).padStart(5, "0")}.${partExtension}`,
      );
      const renderScene = async (
        scene: Project["scenes"][number],
        localStart: number,
        duration: number,
        frames: number,
        path: string,
      ) => {
        await encode(() =>
          runFfmpeg(
            binary,
            creatorSceneArguments({
              project,
              scene,
              localStart,
              duration,
              frames,
              ...dimensions,
              fps,
              output: path,
              bitrate,
              encoder,
              rasters,
              path: (id) => repository.assetPath(id),
              audio,
              lut: scene.adjustments.lutAssetId
                ? lutFiles.get(scene.adjustments.lutAssetId)
                : undefined,
            }),
            { signal, cwd: directory },
          ),
        );
      };
      if (segment.kind === "body")
        await renderScene(
          segment.from.scene,
          segment.fromLocalStart,
          segment.frames / fps,
          segment.frames,
          output,
        );
      else {
        const first = join(directory, `overlap-from.${partExtension}`);
        const second = join(directory, `overlap-to.${partExtension}`);
        const frames = Math.ceil(segment.fullDuration * fps);
        await renderScene(
          segment.from.scene,
          segment.fromLocalStart,
          frames / fps,
          frames,
          first,
        );
        await renderScene(segment.to!.scene, 0, frames / fps, frames, second);
        await encode(() =>
          runFfmpeg(
            binary,
            transitionArguments({
              from: first,
              to: second,
              output,
              segment,
              fps,
              encoder,
              bitrate,
              audioOnly,
            }),
            { signal },
          ),
        );
        await rm(first);
        await rm(second);
      }
      files.push(output);
      completed += segment.frames / fps;
      progress({
        fraction: Math.min(0.85, (completed / total) * 0.85),
        message: `Rendering part ${index + 1} of ${segments.length}`,
      });
    }
    const manifest = join(directory, "parts.txt");
    await writeFile(
      manifest,
      files.map((path) => `file '${basename(path)}'`).join("\n"),
    );
    let finished = join(directory, `joined.${partExtension}`);
    await runFfmpeg(
      binary,
      [
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        manifest,
        "-c",
        "copy",
        "-t",
        String(total),
        ...(audioOnly ? [] : ["-movflags", "+faststart"]),
        finished,
      ],
      { signal },
    );
    for (const file of files) await rm(file);
    if (!audioOnly)
      finished = await encode(() =>
        burnSubtitles(
          binary,
          project,
          request.subtitleOverlays ?? [],
          finished,
          directory,
          total,
          bitrate,
          signal,
          { rasters, rangeStart: range.start, fps, encoder },
        ),
      );
    const loops = new Map<string, string>();
    for (const [index, clip] of (project.output.format === "gif"
      ? []
      : projectAudioClips(project)
    ).entries()) {
      const asset = project.assets[clip.assetId];
      const source = repository.assetPath(asset.id);
      if ((await stat(source)).size !== asset.size)
        throw new Error(`Audio is incomplete: ${asset.name}`);
      if (clip.loop && clip.offset) {
        const path = join(directory, `loop-${index}.wav`);
        await runFfmpeg(
          binary,
          [
            "-ss",
            String(clip.offset),
            "-i",
            source,
            "-vn",
            "-t",
            String(asset.duration - clip.offset),
            "-ar",
            "48000",
            "-ac",
            "2",
            path,
          ],
          { signal },
        );
        loops.set(clip.id, path);
      }
    }
    const mixed = join(directory, `mixed.${partExtension}`);
    const mix =
      project.output.format === "gif"
        ? null
        : soundMixArguments(
            project,
            repository,
            finished,
            mixed,
            total,
            loops,
            range.start,
            audioOnly,
          );
    if (mix) {
      progress({ fraction: 0.9, message: "Mixing the soundtrack" });
      await runFfmpeg(binary, mix, { signal });
      finished = mixed;
    }
    if (project.output.format === "gif") {
      const palette = join(directory, "palette.png");
      const converted = join(directory, "finished.gif");
      await runFfmpeg(
        binary,
        gifPaletteArguments(finished, palette, project.output.quality),
        { signal },
      );
      await runFfmpeg(binary, gifMovieArguments(finished, palette, converted), {
        signal,
      });
      finished = converted;
    } else if (project.output.format === "m4a") {
      const converted = join(directory, "finished.m4a");
      await runFfmpeg(
        binary,
        ["-i", finished, "-vn", "-c:a", "aac", "-b:a", "192k", converted],
        { signal },
      );
      finished = converted;
    }
    signal.throwIfAborted();
    progress({ fraction: 0.98, message: "Saving the finished file" });
    await writeAtomic(destination, async (path) => {
      await copyFile(finished, path);
      signal.throwIfAborted();
    });
    progress({ fraction: 1, message: "Your movie is ready" });
  } finally {
    const absolute = resolve(directory);
    const inside = relative(resolve(tmpdir()), absolute);
    if (
      !inside.startsWith("..") &&
      !inside.includes(":") &&
      basename(absolute).startsWith(PREFIX)
    )
      await rm(absolute, { recursive: true, force: true });
  }
}
