import type { Project } from "../../contracts/project";

// Time O(assets + scenes), space O(assets + scenes). Originals are never copied in memory.
/** Give imported media fresh local identities so a failed import cannot overwrite an open film. */
export function rekeyProjectAssets(project: Project): {
  project: Project;
  identifiers: Map<string, string>;
} {
  const identifiers = new Map(
    Object.keys(project.assets).map((id) => [id, crypto.randomUUID()]),
  );
  const assets: Project["assets"] = {};
  for (const [oldId, asset] of Object.entries(project.assets)) {
    const id = identifiers.get(oldId)!;
    assets[id] = {
      ...asset,
      id,
      ...(asset.originalAssetId
        ? { originalAssetId: identifiers.get(asset.originalAssetId)! }
        : {}),
      ...(asset.proxyAssetId
        ? { proxyAssetId: identifiers.get(asset.proxyAssetId)! }
        : {}),
    };
  }
  return {
    identifiers,
    project: {
      ...project,
      id: crypto.randomUUID(),
      assets,
      scenes: project.scenes.map((scene) => ({
        ...scene,
        assetId: scene.assetId ? identifiers.get(scene.assetId)! : null,
        layers: scene.layers.map((layer) => ({
          ...layer,
          assetId: layer.assetId ? identifiers.get(layer.assetId)! : null,
        })),
        backdrop: {
          ...scene.backdrop,
          assetId: scene.backdrop.assetId
            ? identifiers.get(scene.backdrop.assetId)!
            : null,
        },
        adjustments: {
          ...scene.adjustments,
          ...(scene.adjustments.lutAssetId
            ? { lutAssetId: identifiers.get(scene.adjustments.lutAssetId)! }
            : {}),
        },
      })),
      audioClips: project.audioClips.map((clip) => ({
        ...clip,
        assetId: identifiers.get(clip.assetId)!,
      })),
    },
  };
}
