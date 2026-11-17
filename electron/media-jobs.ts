import { randomUUID } from "node:crypto";
import { mkdtemp, stat, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  mediaOperationSchema,
  type MediaOperation,
  type MediaOperationResult,
} from "../contracts/services";
import {
  LIMITS,
  mediaAssetSchema,
  parseProject,
  type MediaAsset,
  type Project,
} from "../contracts/project";
import type { ImportedMedia } from "../contracts/platform";
import { runFfmpeg } from "./ffmpeg-process";
import type { FileProjectRepository } from "./storage";
import { phoneVideoArguments } from "../src/media/phone-plan";
import { tempoFilters } from "./movie-filters";

const PREFIX = "corto-media-job-";
const VIDEO_MIMES: Readonly<Record<string, string>> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  "3gp": "video/3gpp",
  vob: "video/mpeg",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  gif: "image/gif",
  tif: "image/tiff",
  tiff: "image/tiff",
};

/** Blob-backed captures use a private bounded temporary file; disk selections stream directly. */
export async function importNativeSelection(
  binary: string,
  repository: FileProjectRepository,
  source: string | Uint8Array,
  name: string,
  signal: AbortSignal,
): Promise<ImportedMedia> {
  if (typeof source === "string")
    return importNativeMedia(binary, repository, source, name, signal);
  if (
    !(source instanceof Uint8Array) ||
    source.length > 64 * 1024 ** 2 ||
    !source.length
  )
    throw new Error("The local recording exceeds the import budget");
  const directory = await mkdtemp(join(tmpdir(), PREFIX));
  try {
    const path = join(directory, "capture.bin");
    await writeFile(path, source);
    return await importNativeMedia(binary, repository, path, name, signal);
  } finally {
    await cleanup(directory);
  }
}

/** Read bundled-FFmpeg metadata rather than treating Chromium's codec set as the import policy. */
export function mediaMetadata(
  diagnostic: string,
): Pick<MediaAsset, "duration" | "width" | "height" | "hasAudio" | "fps"> {
  const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(diagnostic);
  const video =
    diagnostic.split("\n").find((line) => line.includes("Video:")) ?? "";
  const dimensions = /Video:.*?\b(\d{1,5})x(\d{1,5})\b/.exec(video);
  const fps = /([\d.]+) fps/.exec(video);
  return {
    duration: duration
      ? Number(duration[1]) * 3600 +
        Number(duration[2]) * 60 +
        Number(duration[3])
      : 0,
    width: dimensions ? Number(dimensions[1]) : 0,
    height: dimensions ? Number(dimensions[2]) : 0,
    hasAudio: /Stream #.*Audio:/.test(diagnostic),
    ...(fps && Number(fps[1]) > 0 && Number(fps[1]) <= 240
      ? { fps: Number(fps[1]) }
      : {}),
  };
}
async function probe(
  binary: string,
  source: string,
  signal: AbortSignal,
): Promise<string> {
  return runFfmpeg(
    binary,
    ["-loglevel", "info", "-protocol_whitelist", "file,pipe", "-i", source],
    { signal, allowFailure: true },
  );
}
async function cleanup(directory: string): Promise<void> {
  const absolute = resolve(directory);
  const inside = relative(resolve(tmpdir()), absolute);
  if (
    !inside.startsWith("..") &&
    !inside.includes(":") &&
    basename(absolute).startsWith(PREFIX)
  )
    await rm(absolute, { recursive: true, force: true });
}

/** Import native legacy codecs as compatible copies; preserve every selected original byte. */
export async function importNativeMedia(
  binary: string,
  repository: FileProjectRepository,
  source: string,
  name: string,
  signal: AbortSignal,
): Promise<ImportedMedia> {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!VIDEO_MIMES[extension])
    throw new Error("Choose a supported video, GIF or TIFF file");
  const size = (await stat(source)).size;
  if (size <= 0 || size > LIMITS.assetBytes)
    throw new Error("Choose a complete original within the 8 GB file limit");
  const diagnostic = await probe(binary, source, signal);
  const metadata = mediaMetadata(diagnostic);
  if (!metadata.width || !metadata.height)
    throw new Error(
      "The bundled decoder could not read a picture in this file",
    );
  const still = ["tif", "tiff"].includes(extension);
  const compatible =
    extension === "mp4" &&
    /Video: h264/.test(diagnostic) &&
    !/bt2020|smpte2084|arib-std-b67/.test(diagnostic);
  const asset = mediaAssetSchema.parse({
    id: randomUUID(),
    name,
    kind: still ? "image" : "video",
    mime: VIDEO_MIMES[extension],
    size,
    ...metadata,
    duration: still ? 0 : metadata.duration,
    animated: extension === "gif",
  });
  if (compatible) {
    await repository.putAsset(asset, source);
    return { asset };
  }
  const directory = await mkdtemp(join(tmpdir(), PREFIX));
  try {
    const output = join(directory, still ? "picture.png" : "compatible.mp4");
    await runFfmpeg(
      binary,
      still
        ? ["-i", source, "-frames:v", "1", "-threads", "1", output]
        : phoneVideoArguments(
            source,
            output,
            /bt2020|smpte2084|arib-std-b67/.test(diagnostic),
          ),
      { signal },
    );
    const original = { ...asset, isOriginalOnly: true };
    const convertedDiagnostic = await probe(binary, output, signal);
    const convertedMetadata = mediaMetadata(convertedDiagnostic);
    if (!convertedMetadata.width || !convertedMetadata.height) throw new Error(`The converted media has no readable picture: ${convertedDiagnostic}`);
    const converted = mediaAssetSchema.parse({
      ...asset,
      ...convertedMetadata,
      duration: still
        ? 0
        : convertedMetadata.duration,
      id: randomUUID(),
      mime: still ? "image/png" : "video/mp4",
      size: (await stat(output)).size,
      originalAssetId: original.id,
    });
    await repository.putAsset(original, source);
    await repository.putAsset(converted, output);
    return { asset: converted, original };
  } finally {
    await cleanup(directory);
  }
}

/** Fixed operations never accept filter text, binary names or filesystem paths from the renderer. */
export async function processNativeMedia(
  binary: string,
  repository: FileProjectRepository,
  input: Project,
  request: MediaOperation,
  signal: AbortSignal,
): Promise<MediaOperationResult> {
  const project = parseProject(input);
  const operation = mediaOperationSchema.parse(request);
  const asset = project.assets[operation.assetId];
  if (!asset || asset.isOriginalOnly || asset.kind === "lut")
    throw new Error("Choose playable media from this film");
  const source = repository.assetPath(asset.id);
  if ((await stat(source)).size !== asset.size)
    throw new Error("The original is missing or incomplete");
  const start = operation.start;
  const duration = operation.duration ?? asset.duration - start;
  if (
    (start >= asset.duration && asset.kind !== "image") ||
    (duration <= 0 && operation.operation !== "frame") ||
    (start + duration > asset.duration + 0.01 && asset.kind !== "image")
  )
    throw new Error("Choose a valid source range");
  const directory = await mkdtemp(join(tmpdir(), PREFIX));
  try {
    const base = [
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      source,
    ];
    if (operation.operation === "scenes") {
      await runFfmpeg(
        binary,
        [
          ...base,
          "-vf",
          `fps=2,select='gt(scene,${operation.threshold})',metadata=print:file=points.txt`,
          "-an",
          "-f",
          "null",
          "-",
        ],
        { signal, cwd: directory },
      );
      const path = join(directory, "points.txt");
      if ((await stat(path)).size > LIMITS.manifestBytes)
        throw new Error(
          "Too many cuts were detected; increase the detection threshold",
        );
      const text = await readFile(path, "utf8");
      const boundaries = [...text.matchAll(/pts_time:([\d.]+)/g)]
        .map((match) => Number(match[1]) + start)
        .filter((time) => time > start + 0.25 && time < start + duration - 0.25)
        .slice(0, LIMITS.scenes - 1);
      return { boundaries };
    }
    const frame = operation.operation === "frame";
    const audioOnly = ["audio", "denoise", "normalize"].includes(
      operation.operation,
    );
    const extension = frame ? "png" : audioOnly ? "wav" : "mp4";
    const output = join(directory, `result.${extension}`);
    if (frame)
      await runFfmpeg(
        binary,
        [
          "-ss",
          String(start),
          "-i",
          source,
          "-frames:v",
          "1",
          "-threads",
          "1",
          output,
        ],
        { signal },
      );
    else if (operation.operation === "reverse") {
      const parts: string[] = [];
      const chunkSeconds = 5;
      for (let offset = 0; offset < duration; offset += chunkSeconds) {
        const part = `reverse-${parts.length}.mp4`;
        const span = Math.min(chunkSeconds, duration - offset);
        await runFfmpeg(
          binary,
          [
            "-ss",
            String(start + offset),
            "-t",
            String(span),
            "-i",
            source,
            "-vf",
            "reverse",
            ...(asset.hasAudio === false ? ["-an"] : ["-af", "areverse"]),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-threads",
            "2",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            join(directory, part),
          ],
          { signal },
        );
        parts.unshift(part);
      }
      await writeFile(
        join(directory, "reverse.txt"),
        parts.map((part) => `file '${part}'`).join("\n"),
      );
      await runFfmpeg(
        binary,
        [
          "-f",
          "concat",
          "-safe",
          "1",
          "-i",
          join(directory, "reverse.txt"),
          "-c",
          "copy",
          output,
        ],
        { signal },
      );
    } else {
      const filter =
        operation.operation === "denoise"
          ? "afftdn=nf=-25"
          : operation.operation === "normalize"
            ? "loudnorm=I=-16:TP=-1.5:LRA=11"
            : operation.operation === "stabilize"
              ? "deshake=rx=32:ry=32:edge=mirror"
              : "scale='min(960,iw)':-2";
      await runFfmpeg(
        binary,
        [
          ...base,
          ...(audioOnly
            ? [
                "-vn",
                "-af",
                [
                  operation.operation === "audio" ? "anull" : filter,
                  "aresample=48000",
                  ...tempoFilters(operation.speed, operation.preservePitch),
                ].join(","),
                "-ar",
                "48000",
                "-ac",
                "2",
                "-c:a",
                "pcm_s16le",
              ]
            : [
                "-vf",
                filter,
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                operation.operation === "proxy" ? "26" : "18",
                "-threads",
                "2",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
              ]),
          output,
        ],
        { signal },
      );
    }
    const metadata = mediaMetadata(await probe(binary, output, signal));
    const result = mediaAssetSchema.parse({
      id: randomUUID(),
      name: `${asset.name.replace(/\.[^.]+$/, "")} — ${operation.operation}.${extension}`,
      kind: frame ? "image" : audioOnly ? "audio" : "video",
      mime: frame ? "image/png" : audioOnly ? "audio/wav" : "video/mp4",
      size: (await stat(output)).size,
      ...metadata,
      ...(frame ? { duration: 0 } : {}),
      ...(operation.operation === "proxy" ? { isProxy: true } : {}),
    });
    await repository.putAsset(result, output);
    return { media: { asset: result } };
  } finally {
    await cleanup(directory);
  }
}
