import {
  assertSceneMedia,
  DEFAULT_PHOTO_SECONDS,
  LIMITS,
  mediaAssetSchema,
  projectSchema,
  sceneSchema,
  type MediaAsset,
  type Project,
  type Scene,
} from "../../contracts/project";
import { sliceScene } from "./scene-slice";
import { transitionOverlap } from "./composition";

/** Create an empty, versioned project with a stable opaque identifier. */
export function createProject(name = "Untitled film"): Project {
  return projectSchema.parse({
    schemaVersion: 3,
    id: crypto.randomUUID(),
    name,
    ratio: "landscape",
    assets: {},
    scenes: [],
    audioClips: [],
    subtitles: [],
    duckMusic: false,
  });
}

/** Create an editable scene without touching the immutable source file. */
export function createScene(
  asset: MediaAsset | null,
  id: string = crypto.randomUUID(),
): Scene {
  if (asset && asset.kind !== "image" && asset.kind !== "video")
    throw new Error("Add audio as the soundtrack instead");
  const duration =
    asset?.kind === "video"
      ? Math.min(asset.duration, LIMITS.sceneSeconds)
      : DEFAULT_PHOTO_SECONDS;
  return sceneSchema.parse({
    id,
    assetId: asset?.id ?? null,
    duration,
    start: 0,
    caption: asset ? "" : "Your title here",
    captionStyle: "classic",
    captionPosition: "center",
    fit: "cover",
    transition: "cut",
    volume: 1,
    background: "#151517",
  });
}

/** Add validated media metadata; original bytes live behind the platform adapter. */
export function addAsset(project: Project, input: MediaAsset): Project {
  const asset = mediaAssetSchema.parse(input);
  if (Object.hasOwn(project.assets, asset.id))
    throw new Error("This media identifier already exists");
  const assets = Object.values(project.assets);
  if (assets.length >= LIMITS.assets)
    throw new Error("This project has too many media files");
  if (
    assets.reduce((total, item) => total + item.size, asset.size) >
    LIMITS.projectBytes
  )
    throw new Error("This project exceeds the 64 GB media limit");
  return { ...project, assets: { ...project.assets, [asset.id]: asset } };
}

function sceneIndex(project: Project, id: string): number {
  const index = project.scenes.findIndex((scene) => scene.id === id);
  if (index < 0) throw new Error("The selected scene no longer exists");
  return index;
}

function assertDuration(scenes: readonly Scene[]): void {
  if (scenes.length > LIMITS.scenes)
    throw new Error("This project has too many scenes");
  if (
    scenes.reduce((total, scene) => total + scene.duration, 0) >
    LIMITS.filmSeconds
  )
    throw new Error("Keep this film within three hours");
}

/** Append a scene while validating its source and the film's duration budget. */
export function appendScene(project: Project, input: Scene): Project {
  const scene = sceneSchema.parse(input);
  assertSceneMedia(scene, project.assets);
  if (project.scenes.some((item) => item.id === scene.id))
    throw new Error("Scene identifiers must be unique");
  const scenes = [...project.scenes, scene];
  assertDuration(scenes);
  return { ...project, scenes };
}

/** Change one scene; untouched scene and asset references remain shared with history. */
export function changeScene(
  project: Project,
  id: string,
  changes: Partial<Omit<Scene, "id" | "assetId">>,
): Project {
  const index = sceneIndex(project, id);
  const scene = sceneSchema.parse({ ...project.scenes[index], ...changes });
  assertSceneMedia(scene, project.assets);
  const scenes = [...project.scenes];
  scenes[index] = scene;
  assertDuration(scenes);
  return { ...project, scenes };
}

/** Remove an occurrence from the storyboard, retaining the original media in the library. */
export function removeScene(project: Project, id: string): Project {
  sceneIndex(project, id);
  return {
    ...project,
    scenes: project.scenes.filter((scene) => scene.id !== id),
  };
}

/** Move a scene to a zero-based destination without mutating the previous project. */
export function moveScene(
  project: Project,
  id: string,
  destination: number,
): Project {
  const source = sceneIndex(project, id);
  const target = Math.max(
    0,
    Math.min(project.scenes.length - 1, Math.trunc(destination)),
  );
  if (!Number.isFinite(target)) throw new Error("Invalid scene destination");
  if (source === target) return project;
  const scenes = [...project.scenes];
  const [scene] = scenes.splice(source, 1);
  scenes.splice(target, 0, scene);
  return { ...project, scenes };
}

/** Duplicate an occurrence directly after itself, preserving its editing settings. */
export function duplicateScene(
  project: Project,
  id: string,
  newId: string = crypto.randomUUID(),
): Project {
  const index = sceneIndex(project, id);
  const copy = sceneSchema.parse({ ...project.scenes[index], id: newId });
  if (project.scenes.some((scene) => scene.id === newId))
    throw new Error("Scene identifiers must be unique");
  const scenes = [...project.scenes];
  scenes.splice(index + 1, 0, copy);
  assertDuration(scenes);
  return { ...project, scenes };
}

/** Split at a local offset; video halves retain contiguous, non-overlapping source ranges. */
export function splitScene(
  project: Project,
  id: string,
  offset: number,
  newId: string = crypto.randomUUID(),
): Project {
  const index = sceneIndex(project, id);
  const scene = project.scenes[index];
  if (
    !Number.isFinite(offset) ||
    offset < LIMITS.minimumSceneSeconds ||
    scene.duration - offset < LIMITS.minimumSceneSeconds
  )
    throw new Error("Split at least 0.25 seconds from either end");
  if (project.scenes.some((item) => item.id === newId))
    throw new Error("Scene identifiers must be unique");
  const kind = scene.assetId ? project.assets[scene.assetId].kind : null;
  const first = {
    ...sliceScene(scene, kind, 0, offset, scene.id),
    transition: "cut" as const,
  };
  const second = sliceScene(
    scene,
    kind,
    offset,
    scene.duration - offset,
    newId,
  );
  const previous = project.scenes[index - 1];
  const next = project.scenes[index + 1];
  if (
    (previous &&
      Math.abs(
        transitionOverlap(previous, scene) - transitionOverlap(previous, first),
      ) > 0.001) ||
    Math.abs(transitionOverlap(scene, next) - transitionOverlap(second, next)) >
      0.001
  )
    throw new Error(
      "Split outside the transition area, or shorten the neighbouring transition first",
    );
  const scenes = [...project.scenes];
  scenes.splice(index, 1, first, second);
  assertDuration(scenes);
  return { ...project, scenes };
}
