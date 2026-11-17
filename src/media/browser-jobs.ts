import {
  mediaOperationSchema,
  type MediaOperation,
  type MediaOperationResult,
} from "../../contracts/services";
import { parseProject, type Project } from "../../contracts/project";
import type { BrowserProjectRepository } from "../platform/browser-repository";
import { localCodec, codecBytes } from "./local-codec";
import { inspectFile } from "./import";

/** Browser media tools use the bundled codec in a disposable local worker. */
export async function processBrowserMedia(
  repository: BrowserProjectRepository,
  input: Project,
  request: MediaOperation,
  signal = new AbortController().signal,
): Promise<MediaOperationResult> {
  const project = parseProject(input);
  const operation = mediaOperationSchema.parse(request);
  const asset = project.assets[operation.assetId];
  if (!asset || asset.isOriginalOnly)
    throw new Error("Choose playable media from this film");
  const blob = await repository.assetBlob(asset.id);
  return localCodec(blob, asset.name, signal, async (codec, source) => {
    const duration = operation.duration ?? asset.duration - operation.start;
    const base = [
      "-ss",
      String(operation.start),
      "-t",
      String(duration),
      "-i",
      source,
    ];
    if (operation.operation === "scenes") {
      const code = await codec.exec([
        ...base,
        "-vf",
        `fps=2,select='gt(scene,${operation.threshold})',metadata=print:file=points.txt`,
        "-an",
        "-f",
        "null",
        "-",
      ]);
      if (code) throw new Error("Scene detection could not read this clip");
      const text = new TextDecoder().decode(
        await codecBytes(codec, "points.txt"),
      );
      return {
        boundaries: [...text.matchAll(/pts_time:([\d.]+)/g)]
          .map((match) => Number(match[1]) + operation.start)
          .filter(
            (time) =>
              time > operation.start + 0.25 &&
              time < operation.start + duration - 0.25,
          )
          .slice(0, 999),
      };
    }
    const frame = operation.operation === "frame";
    const audio = ["audio", "denoise", "normalize"].includes(
      operation.operation,
    );
    const extension = frame ? "png" : audio ? "wav" : "mp4";
    const output = `result.${extension}`;
    const tempo: string[] = [];
    let speed = operation.speed;
    while (speed > 2) {
      tempo.push("atempo=2");
      speed /= 2;
    }
    while (speed < 0.5) {
      tempo.push("atempo=0.5");
      speed *= 2;
    }
    if (speed !== 1) tempo.push(`atempo=${speed}`);
    const audioFilter = [
      operation.operation === "denoise"
        ? "afftdn=nf=-25"
        : operation.operation === "normalize"
          ? "loudnorm=I=-16:TP=-1.5:LRA=11"
          : "anull",
      ...(operation.preservePitch
        ? tempo
        : [`asetrate=48000*${operation.speed}`, "aresample=48000"]),
    ].join(",");
    if (operation.operation === "reverse") {
      const parts: string[] = [];
      for (let offset = 0; offset < duration; offset += 1) {
        const part = `reverse-${parts.length}.mp4`;
        const code = await codec.exec([
          "-ss",
          String(operation.start + offset),
          "-t",
          String(Math.min(1, duration - offset)),
          "-i",
          source,
          "-vf",
          "reverse",
          "-af",
          "areverse",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          part,
        ]);
        if (code)
          throw new Error(
            "This clip could not be reversed in the browser; use the desktop app",
          );
        parts.unshift(part);
        signal.throwIfAborted();
      }
      await codec.writeFile(
        "parts.txt",
        parts.map((part) => `file '${part}'`).join("\n"),
      );
      if (
        await codec.exec([
          "-f",
          "concat",
          "-safe",
          "1",
          "-i",
          "parts.txt",
          "-c",
          "copy",
          output,
        ])
      )
        throw new Error("The reversed clip could not be assembled");
    } else {
      const args = frame
        ? [
            "-ss",
            String(operation.start),
            "-i",
            source,
            "-frames:v",
            "1",
            output,
          ]
        : [
            ...base,
            ...(audio
              ? [
                  "-vn",
                  "-af",
                  audioFilter,
                  "-ar",
                  "48000",
                  "-ac",
                  "2",
                  "-c:a",
                  "pcm_s16le",
                ]
              : [
                  "-vf",
                  operation.operation === "stabilize"
                    ? "deshake=rx=32:ry=32:edge=mirror"
                    : "scale='min(960,iw)':-2",
                  "-c:v",
                  "libx264",
                  "-preset",
                  "ultrafast",
                  "-crf",
                  "20",
                  "-pix_fmt",
                  "yuv420p",
                  "-c:a",
                  "aac",
                ]),
            output,
          ];
      if (await codec.exec(args))
        throw new Error(
          "This local media tool could not finish. Try the desktop app with the same portable project.",
        );
    }
    const file = new File(
      [await codecBytes(codec, output)],
      `${asset.name.replace(/\.[^.]+$/, "")} — ${operation.operation}.${extension}`,
      { type: frame ? "image/png" : audio ? "audio/wav" : "video/mp4" },
    );
    const { asset: metadata } = await inspectFile(file);
    const derived =
      operation.operation === "proxy"
        ? { ...metadata, isProxy: true }
        : metadata;
    await repository.putAsset(derived, file);
    return { media: { asset: derived } };
  });
}

/** Decode a small model window, with a bounded browser input and no audio upload. */
export async function browserAudioSamples(
  repository: BrowserProjectRepository,
  project: Project,
  request: {
    assetId: string;
    start: number;
    duration: number;
    speed: number;
    preservePitch: boolean;
  },
): Promise<Float32Array> {
  if (request.duration <= 0 || request.duration > 32)
    throw new Error("Caption audio windows must be at most 32 seconds");
  const asset = project.assets[request.assetId];
  if (!asset) throw new Error("The caption source is missing");
  return localCodec(
    await repository.assetBlob(asset.id),
    asset.name,
    new AbortController().signal,
    async (codec, source) => {
      let speed = request.speed;
      const tempo: string[] = [];
      while (speed > 2) {
        tempo.push("atempo=2");
        speed /= 2;
      }
      while (speed < 0.5) {
        tempo.push("atempo=0.5");
        speed *= 2;
      }
      tempo.push(`atempo=${speed}`);
      const filters = [
        "aresample=48000",
        ...(request.preservePitch
          ? tempo
          : [`asetrate=48000*${request.speed}`, "aresample=48000"]),
        `apad,atrim=duration=${request.duration}`,
      ];
      if (
        await codec.exec([
          "-ss",
          String(request.start),
          "-t",
          String(request.duration * request.speed),
          "-i",
          source,
          "-vn",
          "-af",
          filters.join(","),
          "-ac",
          "1",
          "-ar",
          "16000",
          "-f",
          "f32le",
          "samples.f32",
        ])
      )
        throw new Error("The local caption audio could not be decoded");
      const bytes = await codecBytes(codec, "samples.f32");
      return new Float32Array(bytes.buffer);
    },
  );
}
