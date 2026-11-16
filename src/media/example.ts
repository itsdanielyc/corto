import type { Project } from "../../contracts/project";
import {
  addAsset,
  appendScene,
  changeScene,
  createProject,
  createScene,
} from "../domain/project";
import type { CortoPlatform } from "../platform/types";
import { inspectFile } from "./import";

const files = [
  { source: "braies.jpg", name: "01 · Lago di Braies.jpg", mime: "image/jpeg" },
  {
    source: "lake-iseo.jpg",
    name: "02 · A slower afternoon.jpg",
    mime: "image/jpeg",
  },
  { source: "fusine.jpg", name: "03 · Quiet water.jpg", mime: "image/jpeg" },
  {
    source: "quiet-morning.mp3",
    name: "Quiet morning · original music.mp3",
    mime: "audio/mpeg",
  },
];

/** Load only bundled example assets; no remote photo or font request is made at runtime. */
export async function createExampleProject(
  platform: CortoPlatform,
): Promise<Project> {
  let project = createProject("Mountain days");
  for (const file of files) {
    const response = await fetch(
      `${import.meta.env.BASE_URL}demo/${file.source}`,
    );
    if (!response.ok)
      throw new Error("The bundled example could not be opened");
    const original = new File([await response.blob()], file.name, {
      type: file.mime,
    });
    const { asset } = await inspectFile(original);
    await platform.putAsset(asset, original);
    project = addAsset(project, asset);
    if (asset.kind === "audio")
      project = {
        ...project,
        music: { assetId: asset.id, volume: 0.38, loop: false },
      };
    else project = appendScene(project, createScene(asset));
  }
  project = changeScene(project, project.scenes[0].id, {
    caption: "The days\nwe'll keep.",
    captionStyle: "classic",
    transition: "fade",
  });
  project = changeScene(project, project.scenes[1].id, { transition: "fade" });
  project = changeScene(project, project.scenes[2].id, { transition: "fade" });
  const closing = {
    ...createScene(null),
    caption: "Until next time.",
    duration: 3,
    transition: "fade" as const,
  };
  return appendScene(project, closing);
}
