import {
  EXPORT_FPS,
  FADE_SECONDS,
  type AspectRatio,
  type ExportResolution,
  type Scene,
} from "../../contracts/project";
import { transitionOverlap } from "./composition";

export interface TimelineEntry {
  scene: Scene;
  start: number;
  end: number;
}
export interface LocatedScene extends TimelineEntry {
  index: number;
  localTime: number;
}
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Time O(n), space O(n). Built once per storyboard edit, reused for every playback frame.
/** Precompute cumulative boundaries for a linear storyboard. */
export function buildTimeline(scenes: readonly Scene[]): TimelineEntry[] {
  let end = 0;
  return scenes.map((scene, index) => {
    const start =
      end - (index ? transitionOverlap(scenes[index - 1], scene) : 0);
    end = start + scene.duration;
    return { scene, start, end };
  });
}

// Time O(log n), space O(1). Exact shared boundaries select the following scene.
/** Locate a frame in the storyboard, clamping scrubs outside its bounds. */
export function locateScene(
  timeline: readonly TimelineEntry[],
  time: number,
): LocatedScene | null {
  if (!timeline.length) return null;
  const clamped = Math.max(
    0,
    Math.min(
      Number.isFinite(time) ? time : 0,
      timeline[timeline.length - 1].end,
    ),
  );
  let low = 0;
  let high = timeline.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (clamped >= timeline[middle].start) low = middle;
    else high = middle - 1;
  }
  return {
    ...timeline[low],
    index: low,
    localTime: clamped - timeline[low].start,
  };
}

/** Report the complete film length without rebuilding its timeline. */
export function filmDuration(scenes: readonly Scene[]): number {
  return scenes.reduce(
    (duration, scene, index) =>
      duration + scene.duration - transitionOverlap(scene, scenes[index + 1]),
    0,
  );
}

export interface LocatedComposition {
  from: LocatedScene;
  to: LocatedScene | null;
  progress: number;
}

/** At most two scene decoders are needed for a transition, even in a long film. */
export function locateComposition(
  timeline: readonly TimelineEntry[],
  time: number,
): LocatedComposition | null {
  const current = locateScene(timeline, time);
  if (!current) return null;
  const previous = timeline[current.index - 1];
  if (!previous || previous.end <= time || previous.end <= current.start)
    return { from: current, to: null, progress: 0 };
  return {
    from: {
      ...previous,
      index: current.index - 1,
      localTime: time - previous.start,
    },
    to: current,
    progress: Math.max(
      0,
      Math.min(1, (time - current.start) / (previous.end - current.start)),
    ),
  };
}

// Time O(n), space O(n); each rounding error is carried into the next scene instead of accumulating.
/** Allocate native output frames from cumulative boundaries, keeping total timing within half a frame. */
export function sceneFrameCounts(
  scenes: readonly Scene[],
  fps: number = EXPORT_FPS,
): number[] {
  let seconds = 0;
  let previousFrame = 0;
  return scenes.map((scene) => {
    seconds += scene.duration;
    const nextFrame = Math.round(seconds * fps);
    const count = nextFrame - previousFrame;
    previousFrame = nextFrame;
    return count;
  });
}

/** Format a nonnegative timeline position for human-readable controls. */
export function formatTime(seconds: number): string {
  const wholeSeconds = Math.max(
    0,
    Math.floor(Number.isFinite(seconds) ? seconds : 0),
  );
  return `${String(Math.floor(wholeSeconds / 60)).padStart(2, "0")}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

/** Choose even pixel dimensions accepted by H.264 and browser recording encoders. */
export function frameDimensions(
  ratio: AspectRatio,
  resolution: ExportResolution,
): { width: number; height: number } {
  const short =
    resolution === "2160p" ? 2160 : resolution === "1080p" ? 1080 : 720;
  const long =
    resolution === "2160p" ? 3840 : resolution === "1080p" ? 1920 : 1280;
  if (ratio === "portrait") return { width: short, height: long };
  if (ratio === "square") return { width: short, height: short };
  if (ratio === "classic")
    return { width: Math.round((short * 4) / 3 / 2) * 2, height: short };
  if (ratio === "feed")
    return { width: short, height: Math.round((short * 5) / 4 / 2) * 2 };
  if (ratio === "cinema")
    return { width: long, height: Math.round(long / 2.35 / 2) * 2 };
  return { width: long, height: short };
}

/** Centre media using a uniform scale, either preserving margins or cropping excess. */
export function fitRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: Scene["fit"],
): Rectangle {
  if (sourceWidth <= 0 || sourceHeight <= 0)
    return { x: 0, y: 0, width: targetWidth, height: targetHeight };
  const scale = (fit === "cover" ? Math.max : Math.min)(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

/** Fade through black without overlapping scenes or changing total film duration. */
export function fadeOpacity(scene: Scene, localTime: number): number {
  if (scene.transition !== "fade") return 1;
  const duration = Math.min(
    scene.transitionSeconds ?? FADE_SECONDS,
    scene.duration / 2,
  );
  if (duration <= 0) return 1;
  return Math.max(
    0,
    Math.min(1, localTime / duration, (scene.duration - localTime) / duration),
  );
}
