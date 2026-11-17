import { describe, expect, it } from "vitest";
import { createProject, createScene } from "../../src/domain/project";
import { colourMatrices, transformColour } from "../../src/domain/colour";
import {
  planRenderSegments,
  resolveRenderRange,
} from "../../src/domain/render-plan";

describe("render plan and colour contract", () => {
  it("renders each body/overlap once and keeps rounded frame totals and range phase", () => {
    const first = {
      ...createScene(null),
      duration: 2,
      transition: "dissolve" as const,
      transitionSeconds: 0.5,
    };
    const second = { ...createScene(null), duration: 2 };
    const plan = planRenderSegments([first, second], 30, {
      start: 0,
      end: 3.5,
    });
    expect(plan.map((segment) => [segment.kind, segment.frames])).toEqual([
      ["body", 45],
      ["transition", 15],
      ["body", 45],
    ]);
    const clipped = planRenderSegments([first, second], 30, {
      start: 1.7,
      end: 2.5,
    });
    expect(clipped.reduce((sum, segment) => sum + segment.frames, 0)).toBe(24);
    expect(clipped[0].trimStart).toBeCloseTo(0.2);
    expect(clipped[0].fromLocalStart).toBe(1.5);
    const project = { ...createProject(), scenes: [first, second] };
    expect(resolveRenderRange(project)).toEqual({ start: 0, end: 3.5 });
    expect(() => resolveRenderRange(project, { start: 2, end: 1 })).toThrow();
  });
  it("uses sRGB luminance for monochrome and applies bounded warmth without changing identity", () => {
    const settings = createScene(null).adjustments;
    expect(transformColour(192, 84, 32, colourMatrices(settings))).toEqual([
      192, 84, 32,
    ]);
    expect(
      transformColour(255, 0, 0, colourMatrices({ ...settings, look: "mono" })),
    ).toEqual([54, 54, 54]);
    expect(
      transformColour(
        255,
        255,
        255,
        colourMatrices({ ...settings, warmth: 1 }),
      ),
    ).toEqual([255, 255, 191]);
  });
});
