import {
  sceneSchema,
  type MediaAsset,
  type Scene,
} from "../../contracts/project";
import { cameraPose } from "./composition";

/** Intersect local text/layer timing with a cut, keeping every item active in that section editable. */
export function sliceScene(
  scene: Scene,
  kind: MediaAsset["kind"] | null,
  from: number,
  duration: number,
  id: string,
): Scene {
  const end = from + duration;
  if (from < 0 || duration <= 0 || end > scene.duration + 0.001)
    throw new Error("Choose a slice inside the scene");
  const textItems = scene.textItems.flatMap((item) => {
    const start = Math.max(from, item.start);
    const finish = Math.min(end, item.end ?? scene.duration);
    return finish > start
      ? [
          {
            ...item,
            start: start - from,
            end: item.end === null && finish === end ? null : finish - from,
          },
        ]
      : [];
  });
  const layers = scene.layers.flatMap((layer) => {
    const start = Math.max(from, layer.start);
    const finish = Math.min(end, layer.end ?? scene.duration);
    return finish > start
      ? [
          {
            ...layer,
            start: start - from,
            end: layer.end === null && finish === end ? null : finish - from,
            sourceStart: layer.sourceStart + Math.max(0, from - layer.start),
          },
        ]
      : [];
  });
  const first = cameraPose(scene, from);
  const last = cameraPose(scene, end);
  const transform =
    scene.transform.motion === "none"
      ? scene.transform
      : {
          ...scene.transform,
          motion: "custom" as const,
          focusX: first.focusX,
          focusY: first.focusY,
          zoom: first.zoom,
          endFocusX: last.focusX,
          endFocusY: last.focusY,
          endZoom: last.zoom,
        };
  return sceneSchema.parse({
    ...scene,
    id,
    duration,
    start: kind === "video" ? scene.start + from * scene.speed : 0,
    transform,
    textItems,
    layers,
    audioFadeIn: Math.min(duration, Math.max(0, scene.audioFadeIn - from)),
    audioFadeOut: Math.min(
      duration,
      Math.max(0, scene.audioFadeOut - (scene.duration - end)),
    ),
  });
}
