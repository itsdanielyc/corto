import { availableParallelism } from "node:os";
import type { OutputSettings } from "../contracts/project";
import { runFfmpeg } from "./ffmpeg-process";

import type { Encoder } from "../src/export/ffmpeg-types";
export type { Encoder } from "../src/export/ffmpeg-types";
export { encoderArguments } from "../src/export/encoder-settings";
const cache = new Map<string, string>();
export function rejectHardwareEncoder(binary: string): void {
  cache.set(binary, "libx264");
}

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
