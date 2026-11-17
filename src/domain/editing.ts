import {
  parseProject,
  sceneSchema,
  type Project,
  type Scene,
} from "../../contracts/project";

/** Insert after the chosen scene, keeping one ordered array as the chronology. */
export function insertScenes(
  project: Project,
  scenes: readonly Scene[],
  afterId: string | null,
): Project {
  const index = afterId
    ? project.scenes.findIndex((scene) => scene.id === afterId) + 1
    : project.scenes.length;
  return parseProject({
    ...project,
    scenes: [
      ...project.scenes.slice(0, index),
      ...scenes,
      ...project.scenes.slice(index),
    ],
  });
}

/** Clipboard/duplicate instances own all editable layer identities while sharing original assets. */
export function cloneScenes(scenes: readonly Scene[]): Scene[] {
  return scenes.map((scene) =>
    sceneSchema.parse({
      ...scene,
      id: crypto.randomUUID(),
      textItems: scene.textItems.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
      layers: scene.layers.map((layer) => ({
        ...layer,
        id: crypto.randomUUID(),
      })),
    }),
  );
}

// Time O(scenes), space O(selection). Shift selection follows storyboard order, not UUID order.
export function selectScenes(
  scenes: readonly Scene[],
  selected: ReadonlySet<string>,
  id: string,
  anchor: string | null,
  additive: boolean,
  range: boolean,
): Set<string> {
  if (range && anchor) {
    const from = scenes.findIndex((scene) => scene.id === anchor);
    const to = scenes.findIndex((scene) => scene.id === id);
    if (from >= 0 && to >= 0)
      return new Set([
        ...(additive ? selected : []),
        ...scenes
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .map((scene) => scene.id),
      ]);
  }
  if (!additive) return new Set([id]);
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function changeScenes(
  project: Project,
  selected: ReadonlySet<string>,
  update: (scene: Scene) => Scene,
): Project {
  return parseProject({
    ...project,
    scenes: project.scenes.map((scene) =>
      selected.has(scene.id) ? update(scene) : scene,
    ),
  });
}

export function sceneEffects(
  scene: Scene,
): Pick<
  Scene,
  | "fit"
  | "transform"
  | "adjustments"
  | "backdrop"
  | "background"
  | "transition"
  | "transitionSeconds"
  | "captionShade"
> {
  return {
    fit: scene.fit,
    transform: { ...scene.transform },
    adjustments: { ...scene.adjustments },
    backdrop: { ...scene.backdrop },
    background: scene.background,
    transition: scene.transition,
    transitionSeconds: scene.transitionSeconds,
    captionShade: scene.captionShade,
  };
}

// Time O(assets + references), space O(assets). Linked originals/proxies form a bounded visited graph.
export function usedAssetIds(project: Project): Set<string> {
  const used = new Set<string>();
  const pending: string[] = [];
  for (const scene of project.scenes)
    pending.push(
      ...[
        scene.assetId,
        scene.backdrop.assetId,
        scene.adjustments.lutAssetId,
        ...scene.layers.map((layer) => layer.assetId),
      ].filter((id): id is string => !!id),
    );
  pending.push(...project.audioClips.map((clip) => clip.assetId));
  while (pending.length) {
    const id = pending.pop()!;
    if (used.has(id)) continue;
    used.add(id);
    const asset = project.assets[id];
    if (asset?.originalAssetId) pending.push(asset.originalAssetId);
    if (asset?.proxyAssetId) pending.push(asset.proxyAssetId);
  }
  return used;
}

/** Manifest cleanup never deletes shared bytes or historical copies from the workspace. */
export function removeUnusedAssets(project: Project): Project {
  const used = usedAssetIds(project);
  return {
    ...project,
    assets: Object.fromEntries(
      Object.entries(project.assets).filter(([id]) => used.has(id)),
    ),
  };
}

/** Replace references after import; validation rejects a shorter incompatible source instead of discarding edits. */
export function replaceMedia(
  project: Project,
  oldId: string,
  newId: string,
): Project {
  if (
    !project.assets[oldId] ||
    !project.assets[newId] ||
    project.assets[oldId].kind !== project.assets[newId].kind
  )
    throw new Error("Choose replacement media of the same kind");
  const replace = (id: string | null) => (id === oldId ? newId : id);
  return parseProject({
    ...project,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      assetId: replace(scene.assetId),
      backdrop: { ...scene.backdrop, assetId: replace(scene.backdrop.assetId) },
      layers: scene.layers.map((layer) => ({
        ...layer,
        assetId: replace(layer.assetId),
      })),
    })),
    audioClips: project.audioClips.map((clip) => ({
      ...clip,
      assetId: replace(clip.assetId)!,
    })),
  });
}
