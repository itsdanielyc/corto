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
    assets[id] = { ...asset, id };
  }
  return {
    identifiers,
    project: {
      ...project,
      assets,
      scenes: project.scenes.map((scene) => ({
        ...scene,
        assetId: scene.assetId ? identifiers.get(scene.assetId)! : null,
      })),
      music: project.music
        ? { ...project.music, assetId: identifiers.get(project.music.assetId)! }
        : null,
    },
  };
}
