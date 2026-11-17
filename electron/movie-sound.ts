import type { Project } from "../contracts/project";
import {
  duckingWindows,
  MUSIC_DUCK_GAIN,
  projectAudioClips,
} from "../src/domain/audio";
import type { FileProjectRepository } from "./storage";

/** Fixed numeric expressions implement the same clip/narration ducking used in preview. */
export function soundMixArguments(
  project: Project,
  repository: FileProjectRepository,
  input: string,
  output: string,
  total: number,
  trimmedLoops: ReadonlyMap<string, string> = new Map(),
  rangeStart = 0,
): string[] | null {
  const clips = projectAudioClips(project).filter(
    (clip) =>
      clip.start < rangeStart + total &&
      clip.start + clip.duration > rangeStart,
  );
  if (!clips.length) return null;
  const arguments_: string[] = ["-t", String(total), "-i", input];
  const filters: string[] = [];
  const windows = project.duckMusic ? duckingWindows(project) : [];
  const duckExpression = windows.length
    ? `if(gt(${windows.map((window) => `between(t,${window.start - rangeStart},${window.end - rangeStart})`).join("+")},0),${MUSIC_DUCK_GAIN},1)`
    : "1";
  for (const [index, clip] of clips.entries()) {
    const skip = Math.max(0, rangeStart - clip.start);
    const start = Math.max(0, clip.start - rangeStart);
    const duration = Math.min(clip.duration - skip, total - start);
    const sourceDuration = project.assets[clip.assetId].duration;
    const loopDuration = sourceDuration - clip.offset;
    if (clip.loop) arguments_.push("-stream_loop", "-1");
    arguments_.push(
      "-ss",
      String(
        trimmedLoops.has(clip.id)
          ? skip % loopDuration
          : clip.loop
            ? (clip.offset + skip) % sourceDuration
            : clip.offset + skip,
      ),
      // Bound the demuxer as well as the filter: looping inputs must have a finite EOF on every engine version.
      "-t",
      String(duration),
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      trimmedLoops.get(clip.id) ?? repository.assetPath(clip.assetId),
    );
    const chain = [
      `atrim=duration=${duration}`,
      "asetpts=PTS-STARTPTS",
      `volume='${clip.volume}*max(0,min(1,min(${clip.fadeIn ? `(t+${skip})/${clip.fadeIn}` : "1"},${clip.fadeOut ? `(${clip.duration - skip}-t)/${clip.fadeOut}` : "1"})))':eval=frame`,
    ];
    chain.push(
      `adelay=${Math.round(start * 1000)}:all=1`,
      `apad=whole_dur=${total}`,
      `atrim=duration=${total}`,
    );
    if (clip.role === "music" && windows.length)
      chain.push(`volume='${duckExpression}':eval=frame`);
    filters.push(`[${index + 1}:a]${chain.join(",")}[sound${index}]`);
  }
  filters.push(
    `[0:a]${clips.map((_, index) => `[sound${index}]`).join("")}amix=inputs=${clips.length + 1}:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=false[sound]`,
  );
  arguments_.push(
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[sound]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-t",
    String(total),
    "-movflags",
    "+faststart",
    output,
  );
  return arguments_;
}
