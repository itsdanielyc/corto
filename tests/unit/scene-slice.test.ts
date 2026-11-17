import { expect, it } from "vitest";
import {
  createProject,
  createScene,
  addAsset,
  splitScene,
} from "../../src/domain/project";
import { textItemSchema, visualLayerSchema } from "../../contracts/creative";
import { parseProject } from "../../contracts/project";
import { filmDuration } from "../../src/domain/timeline";
it("splits source ranges and retains intersecting timed items without adding an overlap", () => {
  const asset = {
    id: "clip",
    name: "clip.mp4",
    kind: "video" as const,
    mime: "video/mp4",
    duration: 12,
    width: 160,
    height: 90,
    size: 12,
  };
  let project = addAsset(createProject(), asset);
  const original = createScene(asset, "first");
  const next = createScene(asset, "next");
  project = {
    ...project,
    scenes: [
      {
        ...original,
        duration: 5,
        start: 1,
        transition: "dissolve",
        transitionSeconds: 0.5,
        transform: { ...original.transform, motion: "zoom-in" },
        textItems: [
          textItemSchema.parse({
            id: "words",
            text: "Keep me",
            start: 1,
            end: 4,
          }),
        ],
        layers: [
          visualLayerSchema.parse({
            id: "pip",
            kind: "media",
            assetId: asset.id,
            start: 2,
            end: 5,
            loop: false,
          }),
        ],
      },
      { ...next, duration: 5 },
    ],
  };
  const split = splitScene(project, "first", 2.5, "second");
  expect(filmDuration(split.scenes)).toBe(filmDuration(project.scenes));
  expect(split.scenes[1].start).toBe(3.5);
  expect(split.scenes[0].textItems[0]).toMatchObject({ start: 1, end: 2.5 });
  expect(split.scenes[1].textItems[0]).toMatchObject({ start: 0, end: 1.5 });
  expect(split.scenes[1].layers[0]).toMatchObject({
    start: 0,
    end: 2.5,
    sourceStart: 0.5,
  });
  expect(() => parseProject(split)).not.toThrow();
  expect(() => splitScene(project, "first", 4.5, "bad")).toThrow("transition");
});
