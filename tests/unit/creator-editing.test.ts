import { expect, it } from "vitest";
import { createProject, createScene, addAsset } from "../../src/domain/project";
import {
  insertScenes,
  cloneScenes,
  selectScenes,
  usedAssetIds,
  removeUnusedAssets,
} from "../../src/domain/editing";
import { buildSlideshow, sortMedia } from "../../src/domain/slideshow";
import type { MediaAsset } from "../../contracts/project";
const photo = (id: string, capturedAt?: string): MediaAsset => ({
  id,
  name: `${id}.jpg`,
  kind: "image",
  mime: "image/jpeg",
  size: 12,
  width: 160,
  height: 90,
  duration: 0,
  capturedAt,
});

it("inserts and copies independent scene/layer identities and extends ordered selections", () => {
  const a = createScene(null, "a");
  const b = createScene(null, "b");
  const c = createScene(null, "c");
  const project = { ...createProject(), scenes: [a, c] };
  expect(
    insertScenes(project, [b], "a").scenes.map((scene) => scene.id),
  ).toEqual(["a", "b", "c"]);
  expect(
    selectScenes([a, b, c], new Set(["a"]), "c", "a", false, true),
  ).toEqual(new Set(["a", "b", "c"]));
  const [copy] = cloneScenes([a]);
  expect(copy.id).not.toBe(a.id);
  expect(copy.caption).toBe(a.caption);
});
it("retains linked immutable originals and removes only unused manifest entries", () => {
  const original = { ...photo("original"), isOriginalOnly: true };
  const playback = { ...photo("playback"), originalAssetId: original.id };
  const project = {
    ...addAsset(
      addAsset(addAsset(createProject(), original), playback),
      photo("unused"),
    ),
    scenes: [createScene(playback)],
  };
  expect(usedAssetIds(project)).toEqual(new Set(["playback", "original"]));
  expect(Object.keys(removeUnusedAssets(project).assets)).toEqual([
    "original",
    "playback",
  ]);
  expect(Object.keys(project.assets)).toHaveLength(3);
});
it("builds a date-sorted, music-fitted editable themed draft with safe minimum timing", () => {
  const early = photo("early", "2020-01-01T12:00:00Z");
  const late = photo("late", "2022-01-01T12:00:00Z");
  const undated = photo("undated");
  expect(
    sortMedia([late, undated, early], "date").map((asset) => asset.id),
  ).toEqual(["early", "late", "undated"]);
  let project = addAsset(
    addAsset(addAsset(createProject(), early), late),
    undated,
  );
  project = buildSlideshow(project, {
    assetIds: [late.id, early.id],
    theme: "family",
    order: "date",
    seconds: 5,
    motion: true,
    dateCaptions: true,
    fitSeconds: 12,
    title: "",
  });
  expect(project.scenes.map((scene) => scene.assetId)).toEqual([
    "early",
    "late",
  ]);
  expect(project.scenes[0].transform.motion).not.toBe("none");
  expect(project.scenes[0].caption).toContain("2020");
  const duration =
    project.scenes.reduce((sum, scene) => sum + scene.duration, 0) -
    project.scenes[0].transitionSeconds;
  expect(duration).toBeCloseTo(12, 3);
  expect(project.scenes.every((scene) => scene.duration >= 0.25)).toBe(true);
});
