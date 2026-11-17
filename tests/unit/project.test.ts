import { describe, expect, it } from "vitest";
import { parseProject, type MediaAsset } from "../../contracts/project";
import {
  addAsset,
  appendScene,
  changeScene,
  createProject,
  createScene,
  duplicateScene,
  moveScene,
  removeScene,
  splitScene,
} from "../../src/domain/project";
import {
  buildTimeline,
  fadeOpacity,
  fitRect,
  formatTime,
  frameDimensions,
  locateScene,
} from "../../src/domain/timeline";
import {
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
} from "../../src/domain/history";

const video: MediaAsset = {
  id: "video-1",
  name: "Birthday.mp4",
  kind: "video",
  mime: "video/mp4",
  size: 1024,
  duration: 12,
  width: 1920,
  height: 1080,
};
const image: MediaAsset = {
  id: "image-1",
  name: "Holiday.jpg",
  kind: "image",
  mime: "image/jpeg",
  size: 512,
  duration: 0,
  width: 1600,
  height: 1000,
};

function film() {
  const project = addAsset(addAsset(createProject("Our summer"), video), image);
  return appendScene(
    appendScene(project, createScene(video, "clip-1")),
    createScene(image, "photo-1"),
  );
}

describe("portable project contract", () => {
  it("rejects inherited object keys as media references", () => {
    const project = {
      ...createProject(),
      scenes: [{ ...createScene(null), assetId: "toString" }],
    };
    expect(() => parseProject(project)).toThrow(/media|identifier/i);
  });
  it("accepts a complete movie and preserves Unicode names", () => {
    const project = { ...film(), name: "Été · 家族" };
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });

  it("rejects future versions, non-finite timing and unknown media references", () => {
    expect(() => parseProject({ ...film(), schemaVersion: 99 })).toThrow();
    expect(() =>
      parseProject({
        ...film(),
        scenes: [{ ...film().scenes[0], duration: NaN }],
      }),
    ).toThrow();
    expect(() => parseProject({ ...film(), assets: {} })).toThrow(/media/i);
  });

  it("rejects path-like identifiers, duplicate scenes and impossible source trims", () => {
    const project = film();
    expect(() =>
      parseProject({ ...project, assets: { "../outside": video } }),
    ).toThrow();
    expect(() =>
      parseProject({
        ...project,
        scenes: [project.scenes[0], project.scenes[0]],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      changeScene(project, "clip-1", { start: 11, duration: 2 }),
    ).toThrow(/source/i);
  });
});

describe("scene editing", () => {
  it("uses source duration for video and a five-second default for photos", () => {
    expect(film().scenes.map((scene) => scene.duration)).toEqual([12, 5]);
    expect(createScene(null, "title-1").assetId).toBeNull();
  });

  it("reorders without losing media, and removes only the selected scene", () => {
    const original = film();
    const moved = moveScene(original, "photo-1", 0);
    expect(moved.scenes.map((scene) => scene.id)).toEqual([
      "photo-1",
      "clip-1",
    ]);
    expect(original.scenes[0].id).toBe("clip-1");
    expect(
      removeScene(moved, "clip-1").scenes.map((scene) => scene.id),
    ).toEqual(["photo-1"]);
    expect(moved.assets).toBe(original.assets);
  });

  it("splits a trimmed video into contiguous source segments", () => {
    const trimmed = changeScene(film(), "clip-1", { start: 2, duration: 8 });
    const split = splitScene(trimmed, "clip-1", 3, "clip-2");
    expect(
      split.scenes
        .slice(0, 2)
        .map(({ start, duration }) => ({ start, duration })),
    ).toEqual([
      { start: 2, duration: 3 },
      { start: 5, duration: 5 },
    ]);
    expect(() => splitScene(trimmed, "clip-1", 0.1, "short")).toThrow();
    expect(() => splitScene(trimmed, "clip-1", 8, "empty")).toThrow();
  });

  it("duplicates directly after a scene and fails loudly for a stale selection", () => {
    expect(
      duplicateScene(film(), "clip-1", "copy").scenes.map((scene) => scene.id),
    ).toEqual(["clip-1", "copy", "photo-1"]);
    expect(() => changeScene(film(), "missing", { caption: "Hello" })).toThrow(
      /scene/i,
    );
  });
});

describe("timeline and composition", () => {
  it("resolves exact boundaries, the end of the film and empty timelines", () => {
    const timeline = buildTimeline(film().scenes);
    expect(locateScene(timeline, 12)?.scene.id).toBe("photo-1");
    expect(locateScene(timeline, 100)?.localTime).toBe(5);
    expect(locateScene(timeline, -5)?.localTime).toBe(0);
    expect(locateScene([], 0)).toBeNull();
    expect(formatTime(65.99)).toBe("01:05");
  });

  it("frames without stretching and produces even export dimensions", () => {
    expect(fitRect(100, 200, 200, 100, "contain")).toEqual({
      x: 75,
      y: 0,
      width: 50,
      height: 100,
    });
    expect(fitRect(100, 200, 200, 100, "cover")).toEqual({
      x: 0,
      y: -150,
      width: 200,
      height: 400,
    });
    expect(frameDimensions("portrait", "1080p")).toEqual({
      width: 1080,
      height: 1920,
    });
    expect(frameDimensions("square", "720p")).toEqual({
      width: 720,
      height: 720,
    });
  });

  it("fades short scenes safely and leaves cuts fully visible", () => {
    const scene = {
      ...createScene(image, "fade"),
      duration: 0.4,
      transition: "fade" as const,
    };
    expect(fadeOpacity(scene, 0)).toBe(0);
    expect(fadeOpacity(scene, 0.2)).toBe(1);
    expect(fadeOpacity({ ...scene, transition: "cut" }, 0)).toBe(1);
  });
});

describe("bounded undo history", () => {
  it("undoes and redoes edits, clears redo after a new edit and bounds memory", () => {
    const first = createProject("First");
    const second = { ...first, name: "Second" };
    const third = { ...first, name: "Third" };
    const history = commitHistory(
      commitHistory(createHistory(first), second, 1),
      third,
      1,
    );
    expect(history.past).toHaveLength(1);
    const undone = undoHistory(history);
    expect(undone.present.name).toBe("Second");
    expect(redoHistory(undone).present.name).toBe("Third");
    expect(commitHistory(undone, first).future).toEqual([]);
    expect(undoHistory(createHistory(first)).present).toBe(first);
  });
});
