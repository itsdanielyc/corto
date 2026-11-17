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
import { chooseEncoder, encoderArguments } from "./encoder";
import { creatorSceneArguments } from "./creator-scene";
import { runFfmpeg } from "./ffmpeg-process";
import { writeAtomic } from "./atomic-file";
import { burnSubtitles } from "./movie-subtitles";
import { soundMixArguments } from "./movie-sound";

const PREFIX = "corto-compose-";
const TRANSITIONS: Readonly<Record<string, string>> = {
  dissolve: "fade",
  "fade-white": "fadewhite",
  "wipe-left": "wipeleft",
  "wipe-right": "wiperight",
  "slide-left": "slideleft",
  "slide-right": "slideright",
  "push-up": "slideup",
  zoom: "zoomin",
  blur: "hblur",
};

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
  const range = resolveRenderRange(project, request.range, request.sample);
  const fps = outputFrameRate(project);
  const dimensions = frameDimensions(project.ratio, request.resolution);
  const segments = planRenderSegments(project.scenes, fps, range);
  const directory = await mkdtemp(join(tmpdir(), PREFIX));
  const total =
    segments.reduce((sum, segment) => sum + segment.frames, 0) / fps;
  if (!segments.length) throw new Error("Add a scene to export");
  const rasters = new Map<string, StagedRaster>(
    request.renderAssetsToken
      ? (cache?.resolve(
          request.renderAssetsToken,
          project,
          request.resolution,
        ) ??
          (() => {
            throw new Error("The render assets are unavailable");
          })())
      : [],
  );
  try {
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
    const audio = new Set<string>();
    const used = new Set(
      project.scenes
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
      const path = repository.assetPath(id);
      if ((await stat(path)).size !== asset.size)
        throw new Error(`Original media is incomplete: ${asset.name}`);
      if (asset.kind === "video") {
        const diagnostic = await runFfmpeg(
          binary,
          ["-loglevel", "info", "-i", path],
          { signal, allowFailure: true },
        );
        if (/Stream #.*Audio:/.test(diagnostic)) audio.add(id);
      }
    }
    const encoder = await chooseEncoder(binary, project.output, signal);
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
    for (const scene of project.scenes)
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
    for (const [index, segment] of segments.entries()) {
      signal.throwIfAborted();
      const output = join(
        directory,
        `part-${String(index).padStart(5, "0")}.mp4`,
      );
      const renderScene = async (
        scene: Project["scenes"][number],
        localStart: number,
        duration: number,
        frames: number,
        path: string,
      ) => {
        await runFfmpeg(
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
        const first = join(directory, "overlap-from.mp4");
        const second = join(directory, "overlap-to.mp4");
        const frames = Math.ceil(segment.fullDuration * fps);
        await renderScene(
          segment.from.scene,
          segment.fromLocalStart,
          frames / fps,
          frames,
          first,
        );
        await renderScene(segment.to!.scene, 0, frames / fps, frames, second);
        await runFfmpeg(
          binary,
          [
            "-i",
            first,
            "-i",
            second,
            "-filter_complex_threads",
            "1",
            "-filter_complex",
            `[0:v]settb=AVTB,setpts=PTS-STARTPTS[a];[1:v]settb=AVTB,setpts=PTS-STARTPTS[b];[a][b]xfade=transition=${TRANSITIONS[segment.from.scene.transition] ?? "fade"}:duration=${segment.fullDuration}:offset=0,trim=start=${segment.trimStart}:duration=${segment.frames / fps},setpts=PTS-STARTPTS[v];[0:a][1:a]acrossfade=d=${segment.fullDuration}:c1=tri:c2=tri,atrim=start=${segment.trimStart}:duration=${segment.frames / fps},asetpts=PTS-STARTPTS[audio]`,
            "-map",
            "[v]",
            "-map",
            "[audio]",
            ...encoderArguments(encoder, bitrate),
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-r",
            String(fps),
            "-frames:v",
            String(segment.frames),
            "-t",
            String(segment.frames / fps),
            output,
          ],
          { signal },
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
    let finished = join(directory, "joined.mp4");
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
        "-movflags",
        "+faststart",
        finished,
      ],
      { signal },
    );
    for (const file of files) await rm(file);
    finished = await burnSubtitles(
      binary,
      project,
      request.subtitleOverlays ?? [],
      finished,
      directory,
      total,
      bitrate,
      signal,
      { rasters, rangeStart: range.start, fps, encoder },
    );
    const loops = new Map<string, string>();
    for (const [index, clip] of projectAudioClips(project).entries()) {
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
    const mixed = join(directory, "mixed.mp4");
    const mix = soundMixArguments(
      project,
      repository,
      finished,
      mixed,
      total,
      loops,
      range.start,
    );
    if (mix) {
      progress({ fraction: 0.9, message: "Mixing the soundtrack" });
      await runFfmpeg(binary, mix, { signal });
      finished = mixed;
    }
    if (project.output.format !== "mp4") {
      const extension = project.output.format;
      const converted = join(directory, `converted.${extension}`);
      const options =
        extension === "gif"
          ? [
              "-an",
              "-filter_complex_threads",
              "1",
              "-filter_complex",
              "fps=15,scale=min(960\\,iw):-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=sierra2_4a",
            ]
          : [
              "-vn",
              "-c:a",
              extension === "wav" ? "pcm_s16le" : "aac",
              ...(extension === "m4a" ? ["-b:a", "192k"] : []),
            ];
      await runFfmpeg(binary, ["-i", finished, ...options, converted], {
        signal,
      });
      finished = converted;
    }
    signal.throwIfAborted();
    progress({ fraction: 0.98, message: "Saving the finished file" });
    await writeAtomic(destination, (path) => copyFile(finished, path));
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
