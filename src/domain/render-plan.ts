import type { Project, Scene } from "../../contracts/project";
import { buildTimeline, filmDuration, type TimelineEntry } from "./timeline";
import { transitionOverlap } from "./composition";

export interface RenderRange {
  start: number;
  end: number;
}
export interface RenderSegment {
  kind: "body" | "transition";
  from: TimelineEntry;
  to: TimelineEntry | null;
  fromLocalStart: number;
  fullDuration: number;
  trimStart: number;
  frames: number;
  outputFrame: number;
}

/** Resolve a bounded range without retiming scene animations or mutating their data. */
export function resolveRenderRange(
  project: Project,
  requested?: RenderRange,
  sample = false,
): RenderRange {
  const duration = filmDuration(project.scenes);
  const range = requested ?? {
    start: 0,
    end: sample ? Math.min(5, duration) : duration,
  };
  if (
    !Number.isFinite(range.start) ||
    !Number.isFinite(range.end) ||
    range.start < 0 ||
    range.end <= range.start ||
    range.end > duration + 0.001
  )
    throw new Error("Choose an export range within the film");
  return { start: range.start, end: Math.min(duration, range.end) };
}

/** Source-match uses the first video frame rate; still-only projects retain the normal 30 fps default. */
export function outputFrameRate(project: Project): number {
  if (project.output.format === "gif") return 15;
  if (project.output.fps !== "source") return project.output.fps;
  const first = project.scenes
    .map((scene) => (scene.assetId ? project.assets[scene.assetId] : null))
    .find((asset) => asset?.kind === "video" && asset.fps);
  return first?.fps && first.fps >= 4 ? first.fps : 30;
}

// Time O(scenes), space O(scenes). No all-scenes filter graph or repeatedly re-encoded prefix is needed.
/** Render main bodies and adjacent overlaps once each, carrying frame rounding across boundaries. */
export function planRenderSegments(
  scenes: readonly Scene[],
  fps: number,
  range: RenderRange,
): RenderSegment[] {
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240)
    throw new Error("Choose a valid frame rate");
  const timeline = buildTimeline(scenes);
  const segments: RenderSegment[] = [];
  const append = (
    kind: RenderSegment["kind"],
    from: TimelineEntry,
    to: TimelineEntry | null,
    absoluteStart: number,
    duration: number,
    localStart: number,
  ) => {
    const start = Math.max(absoluteStart, range.start);
    const end = Math.min(absoluteStart + duration, range.end);
    if (end <= start) return;
    const outputFrame = Math.round((start - range.start) * fps);
    const frames = Math.round((end - range.start) * fps) - outputFrame;
    if (!frames) return;
    segments.push({
      kind,
      from,
      to,
      fromLocalStart:
        kind === "body" ? localStart + start - absoluteStart : localStart,
      fullDuration: kind === "body" ? frames / fps : duration,
      trimStart: kind === "body" ? 0 : start - absoluteStart,
      frames,
      outputFrame,
    });
  };
  for (const [index, entry] of timeline.entries()) {
    const head = index ? transitionOverlap(scenes[index - 1], entry.scene) : 0;
    const tail = transitionOverlap(entry.scene, scenes[index + 1]);
    append(
      "body",
      entry,
      null,
      entry.start + head,
      entry.scene.duration - head - tail,
      head,
    );
    if (tail)
      append(
        "transition",
        entry,
        timeline[index + 1],
        entry.end - tail,
        tail,
        entry.scene.duration - tail,
      );
  }
  return segments;
}
