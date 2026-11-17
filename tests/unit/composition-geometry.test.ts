import { describe, expect, it } from "vitest";
import { createScene } from "../../src/domain/project";
import {
  cameraPose,
  mediaPlacement,
  transitionOverlap,
} from "../../src/domain/composition";
import {
  buildTimeline,
  filmDuration,
  locateScene,
} from "../../src/domain/timeline";

describe("shared composition geometry", () => {
  it("keeps a chosen focal point visible and accounts for quarter-turn dimensions", () => {
    const scene = createScene(null);
    const transform = { ...scene.transform, focusX: 0.25 };
    const placed = mediaPlacement(200, 100, 100, 100, "cover", transform, {
      focusX: 0.25,
      focusY: 0.5,
      zoom: 1,
    });
    expect(placed.x).toBe(-25);
    expect(placed.width).toBe(200);
    const rotated = mediaPlacement(
      200,
      100,
      100,
      100,
      "cover",
      { ...transform, rotation: 90 },
      { focusX: 0.5, focusY: 0.25, zoom: 1 },
    );
    expect(rotated.width).toBe(100);
    expect(rotated.height).toBe(200);
    expect(rotated.y).toBe(-25);
  });
  it("interpolates preset/custom motion deterministically and clamps outside scene time", () => {
    const base = createScene(null);
    const scene = {
      ...base,
      duration: 4,
      transform: { ...base.transform, motion: "zoom-in" as const },
    };
    expect(cameraPose(scene, 2).zoom).toBeCloseTo(1.075);
    expect(cameraPose(scene, -5).zoom).toBe(1);
    expect(cameraPose(scene, 9).zoom).toBeCloseTo(1.15);
    const custom = {
      ...scene,
      transform: {
        ...scene.transform,
        motion: "custom" as const,
        focusX: 0.2,
        endFocusX: 0.8,
        zoom: 1.2,
        endZoom: 1.6,
      },
    };
    expect(cameraPose(custom, 2)).toMatchObject({ focusX: 0.5, zoom: 1.4 });
  });
  it("clamps overlaps to both neighbours and reports the actual shortened film", () => {
    const first = {
      ...createScene(null),
      duration: 2,
      transition: "dissolve" as const,
      transitionSeconds: 0.5,
    };
    const second = { ...createScene(null), duration: 2 };
    expect(transitionOverlap(first, second)).toBe(0.5);
    expect(
      transitionOverlap(
        { ...first, transitionSeconds: 5 },
        { ...second, duration: 0.5 },
      ),
    ).toBe(0.25);
    const timeline = buildTimeline([first, second]);
    expect(timeline[1].start).toBe(1.5);
    expect(filmDuration([first, second])).toBe(3.5);
    expect(locateScene(timeline, 1.75)?.index).toBe(1);
  });
});
