import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MovieRequest } from "../contracts/platform";
import type { Project } from "../contracts/project";
import { runFfmpeg } from "./ffmpeg-process";

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
): Promise<string> {
  const active = project.subtitles.filter((cue) => cue.start < total);
  if (!active.length) return input;
  const byId = new Map(overlays.map((overlay) => [overlay.cueId, overlay.png]));
  const blank = byId.get("");
  if (!blank) throw new Error("The subtitle gap layer is missing");
  await writeFile(join(directory, "subtitle-empty.png"), blank);
  const manifest: string[] = [];
  const addFrame = (name: string, duration: number) => {
    if (duration > 0)
      manifest.push(`file '${name}'`, `duration ${duration.toFixed(6)}`);
  };
  let position = 0;
  let lastFile = "subtitle-empty.png";
  for (const [index, cue] of active.entries()) {
    const png = byId.get(cue.id);
    if (!png) throw new Error("A timed subtitle layer is missing");
    addFrame("subtitle-empty.png", cue.start - position);
    const fileName = `subtitle-${index}.png`;
    await writeFile(join(directory, fileName), png);
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
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-b:v",
      String(bitrate),
      "-threads",
      "2",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "copy",
      "-r",
      "30",
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
