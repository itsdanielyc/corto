import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MovieRequest } from "../contracts/platform";
import type { Project } from "../contracts/project";
import { runFfmpeg } from "./ffmpeg-process";
import type { StagedRaster } from "./render-assets";
import { encoderArguments, type Encoder } from "./encoder";

/** Reuse full-frame PNG subtitle layers, keeping text out of FFmpeg's filter language. */
export async function burnSubtitles(
  binary: string,
  project: Project,
  overlays: NonNullable<MovieRequest["subtitleOverlays"]>,
  input: string,
  directory: string,
  total: number,
  bitrate: number,
  signal: AbortSignal,
  options?: {
    rasters: ReadonlyMap<string, StagedRaster>;
    rangeStart: number;
    fps: number;
    encoder: Encoder;
  },
): Promise<string> {
  const rangeStart = options?.rangeStart ?? 0;
  const active = project.subtitles
    .filter((cue) => cue.start < rangeStart + total && cue.end > rangeStart)
    .map((cue) => ({
      ...cue,
      start: Math.max(0, cue.start - rangeStart),
      end: Math.min(total, cue.end - rangeStart),
    }));
  if (!active.length) return input;
  const byId = new Map(overlays.map((overlay) => [overlay.cueId, overlay.png]));
  const blank = byId.get("");
  const blankPath = options?.rasters.get("subtitle:")?.path;
  if (!blank && !blankPath)
    throw new Error("The subtitle gap layer is missing");
  if (blankPath)
    await copyFile(blankPath, join(directory, "subtitle-empty.png"));
  else await writeFile(join(directory, "subtitle-empty.png"), blank!);
  const manifest: string[] = [];
  const addFrame = (name: string, duration: number) => {
    if (duration > 0)
      manifest.push(`file '${name}'`, `duration ${duration.toFixed(6)}`);
  };
  let position = 0;
  let lastFile = "subtitle-empty.png";
  for (const [index, cue] of active.entries()) {
    const png = byId.get(cue.id);
    const rasterPath = options?.rasters.get(`subtitle:${cue.id}`)?.path;
    if (!png && !rasterPath)
      throw new Error("A timed subtitle layer is missing");
    addFrame("subtitle-empty.png", cue.start - position);
    const fileName = `subtitle-${index}.png`;
    if (rasterPath) await copyFile(rasterPath, join(directory, fileName));
    else await writeFile(join(directory, fileName), png!);
    addFrame(fileName, Math.min(total, cue.end) - cue.start);
    position = Math.min(total, cue.end);
    lastFile = fileName;
  }
  if (position < total) {
    addFrame("subtitle-empty.png", total - position);
    lastFile = "subtitle-empty.png";
  }
  manifest.push(`file '${lastFile}'`);
  const path = join(directory, "subtitle-frames.txt");
  await writeFile(path, manifest.join("\n"));
  const output = join(directory, "subtitled.mp4");
  await runFfmpeg(
    binary,
    [
      "-i",
      input,
      "-f",
      "concat",
      "-safe",
      "1",
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      path,
      "-filter_complex_threads",
      "1",
      "-filter_complex",
      "[0:v][1:v]overlay=0:0:eof_action=pass:format=auto[picture]",
      "-map",
      "[picture]",
      "-map",
      "0:a:0",
      ...encoderArguments(
        options?.encoder ?? { name: "libx264", threads: 2, quality: 70 },
        bitrate,
      ),
      "-c:a",
      "copy",
      "-r",
      String(options?.fps ?? 30),
      "-t",
      String(total),
      "-movflags",
      "+faststart",
      output,
    ],
    { signal },
  );
  return output;
}
