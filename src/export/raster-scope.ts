import type { MovieRequest } from "../../contracts/platform";
import type { Project } from "../../contracts/project";
import {
  planRenderSegments,
  outputFrameRate,
  resolveRenderRange,
} from "../domain/render-plan";

export const sceneRasterKey = (
  kind: "text" | "textmask" | "layer",
  sceneId: string,
  itemId: string,
): string => `${kind}:${sceneId}:${itemId}`;
export function rasterKeys(project: Project): Set<string> {
  const keys = new Set<string>();
  for (const scene of project.scenes) {
    if (scene.caption.trim()) keys.add(`caption:${scene.id}`);
    if (scene.backdrop.kind === "gradient") keys.add(`backdrop:${scene.id}`);
    for (const item of scene.textItems) {
      keys.add(sceneRasterKey("text", scene.id, item.id));
      if (item.animation === "typewriter")
        keys.add(sceneRasterKey("textmask", scene.id, item.id));
    }
    for (const layer of scene.layers)
      if (layer.kind !== "media")
        keys.add(sceneRasterKey("layer", scene.id, layer.id));
  }
  if (project.subtitles.length) {
    keys.add("subtitle:");
    for (const cue of project.subtitles) keys.add(`subtitle:${cue.id}`);
  }
  return keys;
}
/** Prepare only layers that can appear in a sample/range, while the lease remains bound to the full immutable film. */
export function scopedRasterProject(request: MovieRequest): Project {
  const project = request.project;
  const range = resolveRenderRange(project, request.range, request.sample);
  const segments = planRenderSegments(
    project.scenes,
    outputFrameRate(project),
    range,
  );
  const ids = new Set(
    segments.flatMap((segment) => [
      segment.from.scene.id,
      ...(segment.to ? [segment.to.scene.id] : []),
    ]),
  );
  return {
    ...project,
    scenes: project.scenes.filter((scene) => ids.has(scene.id)),
    subtitles: project.subtitles.filter(
      (cue) => cue.start < range.end && cue.end > range.start,
    ),
  };
}
