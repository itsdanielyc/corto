import { gifPaletteArguments, gifMovieArguments } from "./gif";
import { transitionArguments } from "./ffmpeg-transition";
import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
} from "../../contracts/platform";
import { parseProject, type Scene } from "../../contracts/project";
import { frameDimensions } from "../domain/timeline";
import {
  outputFrameRate,
  planRenderSegments,
  resolveRenderRange,
  type RenderSegment,
} from "../domain/render-plan";
import { projectAudioClips } from "../domain/audio";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { projectRasters } from "../preview/rasters";
import { codecBytes } from "../media/local-codec";
import { creatorSceneArguments } from "./ffmpeg-scene";
import { soundMixArguments } from "./ffmpeg-sound";
import { encoderArguments } from "./encoder-settings";
import type { Encoder, StagedRaster } from "./ffmpeg-types";
import { exportBitrate } from "./presets";

const MAX_WORKING_BYTES = 512 * 1024 ** 2;
const MAX_SOURCE_BYTES = 256 * 1024 ** 2;
const MAX_RASTER_BYTES = 128 * 1024 ** 2;
const SEGMENT_SECONDS = 15;

/** Keep a long browser body bounded without restarting its animation phase. */
function splitBodies(
  segments: readonly RenderSegment[],
  fps: number,
): RenderSegment[] {
  return segments.flatMap((segment) => {
    if (segment.kind === "transition") return [segment];
    const result: RenderSegment[] = [];
    const batch = Math.round(SEGMENT_SECONDS * fps);
    for (let frame = 0; frame < segment.frames; frame += batch) {
      const frames = Math.min(batch, segment.frames - frame);
      result.push({
        ...segment,
        frames,
        fullDuration: frames / fps,
        fromLocalStart: segment.fromLocalStart + frame / fps,
        outputFrame: segment.outputFrame + frame,
      });
    }
    return result;
  });
}

// Time O(encoded pixels + source bytes), peak memory bounded by one codec job and explicit working/input budgets.
/** Encode deterministic MP4/GIF/audio from shared native plans, without a wall-clock recorder or media upload. */
export async function renderWasmMovie(
  request: MovieRequest,
  assetUrl: (id: string) => Promise<string>,
  progress: (value: ExportProgress) => void,
  signal: AbortSignal,
): Promise<MovieResult> {
  signal.throwIfAborted();
  const project = parseProject(request.project);
  const audioOnly = ["m4a", "wav"].includes(project.output.format);
  const partExtension = audioOnly ? "wav" : "mp4";
  const range = resolveRenderRange(project, request.range, request.sample);
  const fps = outputFrameRate(project);
  const dimensions = frameDimensions(project.ratio, request.resolution);
  const segments = splitBodies(
    planRenderSegments(project.scenes, fps, range),
    fps,
  );
  const total = segments.reduce((sum, part) => sum + part.frames, 0) / fps;
  if (!segments.length) throw new Error("Add a scene before exporting");
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const codec = new FFmpeg();
  let diagnostic = "";
  let currentProgress = 0;
  codec.on("log", ({ message }) => {
    diagnostic = (diagnostic + message + "\n").slice(-16000);
  });
  const cancel = () => codec.terminate();
  signal.addEventListener("abort", cancel, { once: true });
  // Single-threaded WASM favours lower CPU cost; CRF and the bitrate ceiling still control output quality/size.
  const encoder: Encoder = {
    name: "libx264",
    threads: 1,
    quality: project.output.quality,
    preset: "ultrafast",
  };
  const bitrate = Math.round(
    exportBitrate(request) *
      (request.resolution === "2160p" ? 4 : 1) *
      (0.35 + project.output.quality / 100),
  );
  const assets = new Map<string, { path: string; size: number }>();
  const audio = new Set<string>();
  const rasters = new Map<string, StagedRaster>();
  const run = async (args: string[]) => {
    signal.throwIfAborted();
    diagnostic = "";
    const code = await codec.exec(args);
    signal.throwIfAborted();
    if (code !== 0)
      throw new Error(
        `The local encoder could not finish this part. Try Corto for desktop with the same portable project. ${diagnostic
          .split("\n")
          .filter((line) => /Error|Invalid|No such|not supported/i.test(line))
          .slice(-2)
          .join(" ")}`,
      );
  };
  const assetPath = (id: string) =>
    assets.get(id)?.path ??
    (() => {
      throw new Error("An export source is not loaded");
    })();
  const ensureAsset = async (id: string) => {
    if (assets.has(id)) return;
    const asset = project.assets[id];
    if (!asset || asset.size > MAX_SOURCE_BYTES)
      throw new Error(
        "For individual files larger than 256 MB, use Corto for desktop. Save a portable project to take the same edits and originals with you.",
      );
    if (
      [...assets.values()].reduce((sum, item) => sum + item.size, asset.size) >
      MAX_WORKING_BYTES
    )
      throw new Error(
        "This browser export exceeds the local working-memory budget. Use the desktop app for this film.",
      );
    const response = await fetch(await assetUrl(id));
    if (!response.ok)
      throw new Error(`This original is missing: ${asset.name}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== asset.size)
      throw new Error(`This original is incomplete: ${asset.name}`);
    const path = `asset-${assets.size}-${id}.${asset.kind === "lut" ? "cube" : "bin"}`;
    await codec.writeFile(path, bytes);
    assets.set(id, { path, size: bytes.length });
    if (asset.kind === "video" && project.output.format !== "gif") {
      diagnostic = "";
      await codec.exec(["-hide_banner", "-loglevel", "info", "-i", path]);
      if (/Stream #.*Audio:/.test(diagnostic)) audio.add(id);
    }
  };
  try {
    progress({ fraction: 0, message: "Loading the local movie encoder" });
    const base = new URL(
      `${import.meta.env.BASE_URL}codecs/ffmpeg/`,
      document.baseURI,
    ).href;
    await codec.load({
      classWorkerURL: `${base}worker.js`,
      coreURL: `${base}ffmpeg-core.js`,
      wasmURL: `${base}ffmpeg-core.wasm`,
    });
    signal.throwIfAborted();
    const sceneIds = new Set(
      segments.flatMap((segment) => [
        segment.from.scene.id,
        ...(segment.to ? [segment.to.scene.id] : []),
      ]),
    );
    const scoped = {
      ...project,
      scenes: project.scenes.filter((scene) => sceneIds.has(scene.id)),
      subtitles: project.subtitles.filter(
        (cue) => cue.start < range.end && cue.end > range.start,
      ),
    };
    let rasterBytes = 0;
    for await (const raster of projectRasters(
      audioOnly ? { ...scoped, scenes: [], subtitles: [] } : scoped,
      request.resolution,
      signal,
    )) {
      rasterBytes += raster.png.length;
      if (rasterBytes > MAX_RASTER_BYTES)
        throw new Error(
          "This film's title layers need the desktop encoder's disk-backed staging",
        );
      const path = `raster-${rasters.size}.png`;
      await codec.writeFile(path, raster.png);
      rasters.set(raster.key, {
        path,
        width: raster.width,
        height: raster.height,
      });
    }
    const renderScene = async (
      scene: Scene,
      localStart: number,
      duration: number,
      frames: number,
      output: string,
    ) => {
      const ids = [
        scene.assetId,
        scene.backdrop.assetId,
        scene.adjustments.lutAssetId,
        ...scene.layers.map((layer) => layer.assetId),
      ].filter((id): id is string => !!id);
      for (const id of ids)
        if (!audioOnly || project.assets[id].kind === "video")
          await ensureAsset(id);
      await run(
        creatorSceneArguments({
          project,
          scene,
          localStart,
          duration,
          frames,
          ...dimensions,
          fps,
          output,
          bitrate,
          encoder,
          rasters,
          path: assetPath,
          audio,
          lut:
            !audioOnly && scene.adjustments.lutAssetId
              ? assetPath(scene.adjustments.lutAssetId)
              : undefined,
        }),
      );
    };
    const parts: string[] = [];
    let encodedBytes = 0;
    for (const [index, segment] of segments.entries()) {
      signal.throwIfAborted();
      const output = `part-${index}.${partExtension}`;
      const needed = new Set(
        [segment.from.scene, ...(segment.to ? [segment.to.scene] : [])]
          .flatMap((scene) => [
            scene.assetId,
            scene.backdrop.assetId,
            scene.adjustments.lutAssetId,
            ...scene.layers.map((layer) => layer.assetId),
          ])
          .filter((id): id is string => !!id),
      );
      for (const [id, asset] of assets)
        if (!needed.has(id)) {
          await codec.deleteFile(asset.path);
          assets.delete(id);
        }
      if (segment.kind === "body")
        await renderScene(
          segment.from.scene,
          segment.fromLocalStart,
          segment.frames / fps,
          segment.frames,
          output,
        );
      else {
        const frames = Math.ceil(segment.fullDuration * fps);
        await renderScene(
          segment.from.scene,
          segment.fromLocalStart,
          frames / fps,
          frames,
          `overlap-a.${partExtension}`,
        );
        await renderScene(
          segment.to!.scene,
          0,
          frames / fps,
          frames,
          `overlap-b.${partExtension}`,
        );
        await run(
          transitionArguments({
            from: `overlap-a.${partExtension}`,
            to: `overlap-b.${partExtension}`,
            output,
            segment,
            fps,
            encoder,
            bitrate,
            audioOnly,
          }),
        );
        await codec.deleteFile(`overlap-a.${partExtension}`);
        await codec.deleteFile(`overlap-b.${partExtension}`);
      }
      encodedBytes += (await codecBytes(codec, output)).length;
      if (encodedBytes * 2 + rasterBytes > MAX_WORKING_BYTES)
        throw new Error(
          "This browser movie needs more working memory than is available. Finish the same portable project in Corto for desktop.",
        );
      parts.push(output);
      currentProgress = Math.min(
        0.85,
        ((segment.outputFrame + segment.frames) / (total * fps)) * 0.85,
      );
      progress({
        fraction: currentProgress,
        message: `Encoding part ${index + 1} of ${segments.length}`,
      });
    }
    await codec.writeFile(
      "parts.txt",
      parts.map((path) => `file '${path}'`).join("\n"),
    );
    await run([
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      "parts.txt",
      "-c",
      "copy",
      "-t",
      String(total),
      ...(audioOnly ? [] : ["-movflags", "+faststart"]),
      `joined.${partExtension}`,
    ]);
    for (const path of parts) await codec.deleteFile(path);
    let finished = `joined.${partExtension}`;
    if (!audioOnly && scoped.subtitles.length) {
      const manifest: string[] = [];
      let position = 0;
      let last = rasters.get("subtitle:")!.path;
      const frame = (path: string, seconds: number) => {
        if (seconds > 0)
          manifest.push(`file '${path}'`, `duration ${seconds.toFixed(6)}`);
        last = path;
      };
      for (const cue of scoped.subtitles) {
        const start = Math.max(0, cue.start - range.start);
        const end = Math.min(total, cue.end - range.start);
        frame(rasters.get("subtitle:")!.path, start - position);
        frame(rasters.get(`subtitle:${cue.id}`)!.path, end - start);
        position = end;
      }
      frame(rasters.get("subtitle:")!.path, total - position);
      manifest.push(`file '${last}'`);
      await codec.writeFile("subtitles.txt", manifest.join("\n"));
      await run([
        "-i",
        finished,
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        "subtitles.txt",
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        "[0:v][1:v]overlay=0:0:eof_action=pass:format=auto[v]",
        "-map",
        "[v]",
        "-map",
        "0:a",
        ...encoderArguments(encoder, bitrate),
        "-c:a",
        "copy",
        "-r",
        String(fps),
        "-t",
        String(total),
        "subtitled.mp4",
      ]);
      await codec.deleteFile(finished);
      finished = "subtitled.mp4";
    }
    for (const asset of assets.values()) await codec.deleteFile(asset.path);
    assets.clear();
    const loops = new Map<string, string>();
    for (const [index, clip] of (project.output.format === "gif"
      ? []
      : projectAudioClips(project)
    ).entries()) {
      if (clip.start >= range.end || clip.start + clip.duration <= range.start)
        continue;
      await ensureAsset(clip.assetId);
      if (clip.loop && clip.offset) {
        const path = `loop-${index}.wav`;
        await run([
          "-ss",
          String(clip.offset),
          "-i",
          assetPath(clip.assetId),
          "-vn",
          "-t",
          String(project.assets[clip.assetId].duration - clip.offset),
          "-ar",
          "48000",
          "-ac",
          "2",
          path,
        ]);
        loops.set(clip.id, path);
      }
    }
    const mix =
      project.output.format === "gif"
        ? null
        : soundMixArguments(
            project,
            { assetPath },
            finished,
            `mixed.${partExtension}`,
            total,
            loops,
            range.start,
            audioOnly,
          );
    if (mix) {
      progress({ fraction: 0.91, message: "Mixing music and narration" });
      await run(mix);
      await codec.deleteFile(finished);
      finished = `mixed.${partExtension}`;
    }
    const format = project.output.format;
    if (format === "gif") {
      await run(
        gifPaletteArguments(finished, "palette.png", project.output.quality),
      );
      await run(gifMovieArguments(finished, "palette.png", "result.gif"));
      await codec.deleteFile(finished);
      finished = "result.gif";
    } else if (format === "m4a") {
      await run([
        "-i",
        finished,
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "result.m4a",
      ]);
      await codec.deleteFile(finished);
      finished = "result.m4a";
    }
    signal.throwIfAborted();
    progress({ fraction: 0.98, message: "Preparing the download" });
    const bytes = await codecBytes(codec, finished);
    const fileName = `${projectFileName(project.name)}${request.sample ? "-sample" : ""}.${format}`;
    downloadBlob(
      new Blob([bytes], {
        type:
          format === "gif"
            ? "image/gif"
            : format === "wav"
              ? "audio/wav"
              : format === "m4a"
                ? "audio/mp4"
                : "video/mp4",
      }),
      fileName,
    );
    progress({ fraction: 1, message: "Your movie is ready" });
    return {
      fileName,
      format: format.toUpperCase() as MovieResult["format"],
      location: "download",
    };
  } finally {
    signal.removeEventListener("abort", cancel);
    codec.terminate();
  }
}
