import { availableParallelism } from "node:os";
import type { OutputSettings } from "../contracts/project";
import { runFfmpeg } from "./ffmpeg-process";

export interface Encoder {
  name: string;
  threads: number;
  quality: number;
}
const cache = new Map<string, string>();

/** Probe a real tiny encode; advertised hardware availability alone is insufficient. */
export async function chooseEncoder(
  binary: string,
  settings: OutputSettings,
  signal: AbortSignal,
): Promise<Encoder> {
  const threads =
    settings.threads || Math.max(1, Math.min(8, availableParallelism() - 1));
  let name = "libx264";
  if (settings.encoder !== "software") {
    const known = cache.get(binary);
    if (known) name = known;
    else {
      const candidates =
        process.platform === "darwin"
          ? ["h264_videotoolbox"]
          : [
              "h264_nvenc",
              "h264_qsv",
              ...(process.platform === "win32" ? ["h264_amf"] : []),
            ];
      for (const candidate of candidates) {
        try {
          await runFfmpeg(
            binary,
            [
              "-f",
              "lavfi",
              "-i",
              "color=s=128x128:d=0.1",
              "-frames:v",
              "1",
              "-c:v",
              candidate,
              "-f",
              "null",
              "-",
            ],
            { signal },
          );
          name = candidate;
          break;
        } catch {
          signal.throwIfAborted();
        }
      }
      cache.set(binary, name);
    }
  }
  return { name, threads, quality: settings.quality };
}

export function encoderArguments(encoder: Encoder, bitrate?: number): string[] {
  return [
    "-c:v",
    encoder.name,
    ...(encoder.name === "libx264"
      ? [
          "-preset",
          "veryfast",
          "-crf",
          String(Math.round(35 - encoder.quality * 0.25)),
        ]
      : []),
    ...(bitrate
      ? [
          "-b:v",
          String(bitrate),
          "-maxrate",
          String(Math.round(bitrate * 1.5)),
          "-bufsize",
          String(bitrate * 2),
        ]
      : encoder.name !== "libx264"
        ? ["-b:v", "8000000"]
        : []),
    "-threads",
    String(encoder.threads),
    "-pix_fmt",
    "yuv420p",
  ];
}
