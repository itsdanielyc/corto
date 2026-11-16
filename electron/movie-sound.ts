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
): string[] | null {
  const clips = projectAudioClips(project).filter((clip) => clip.start < total);
  if (!clips.length) return null;
  const arguments_: string[] = ["-i", input];
  const filters: string[] = [];
  const windows = project.duckMusic ? duckingWindows(project) : [];
  const duckExpression = windows.length
    ? `if(gt(${windows.map((window) => `between(t,${window.start},${window.end})`).join("+")},0),${MUSIC_DUCK_GAIN},1)`
    : "1";
  for (const [index, clip] of clips.entries()) {
    if (clip.loop) arguments_.push("-stream_loop", "-1");
    arguments_.push(
      "-ss",
      String(trimmedLoops.has(clip.id) ? 0 : clip.offset),
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      trimmedLoops.get(clip.id) ?? repository.assetPath(clip.assetId),
    );
    const duration = Math.min(clip.duration, total - clip.start);
    const chain = [
      `atrim=duration=${duration}`,
      "asetpts=PTS-STARTPTS",
      `volume=${clip.volume}`,
    ];
    if (clip.fadeIn) chain.push(`afade=t=in:d=${clip.fadeIn}`);
    if (clip.fadeOut)
      chain.push(
        `afade=t=out:st=${Math.max(0, clip.duration - clip.fadeOut)}:d=${clip.fadeOut}`,
      );
    chain.push(
      `adelay=${Math.round(clip.start * 1000)}:all=1`,
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
