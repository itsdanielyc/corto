import type { MovieRequest } from "../../contracts/platform";
import type { ExportResolution, Project } from "../../contracts/project";

export const EXPORT_PRESETS = {
  tv: {
    title: "TV / Full HD",
    subtitle: "Beautiful on a bigger screen",
    resolution: "1080p",
    videoBitrate: 8_000_000,
  },
  phone: {
    title: "Phone / HD",
    subtitle: "A smaller file, easy to share",
    resolution: "720p",
    videoBitrate: 4_000_000,
  },
  small: {
    title: "Small file",
    subtitle: "Compact for messages and email",
    resolution: "720p",
    videoBitrate: 1_200_000,
  },
} as const;
export const EXPORT_AUDIO_BITRATE = 192_000;
export const SAMPLE_SECONDS = 5;

/** Use the same bit budget for file-size guidance and both renderers. */
export function exportBitrate(
  request: Pick<MovieRequest, "preset" | "resolution">,
): number {
  return request.preset
    ? EXPORT_PRESETS[request.preset].videoBitrate
    : request.resolution === "1080p"
      ? EXPORT_PRESETS.tv.videoBitrate
      : EXPORT_PRESETS.phone.videoBitrate;
}
export function estimatedMovieBytes(
  seconds: number,
  preset: keyof typeof EXPORT_PRESETS,
): number {
  return Math.ceil(
    (seconds * (EXPORT_PRESETS[preset].videoBitrate + EXPORT_AUDIO_BITRATE)) /
      8,
  );
}

/** A sample is a non-destructive export view; edits and originals remain untouched. */
export function sampleProject(project: Project, sample = false): Project {
  if (!sample) return project;
  let remaining = SAMPLE_SECONDS;
  const scenes: Project["scenes"] = [];
  for (const scene of project.scenes) {
    if (remaining <= 0) break;
    const duration = Math.min(remaining, scene.duration);
    scenes.push({ ...scene, duration });
    remaining -= duration;
  }
  return { ...project, scenes };
}
export function presetResolution(
  preset: keyof typeof EXPORT_PRESETS,
): ExportResolution {
  return EXPORT_PRESETS[preset].resolution;
}
