import { describe, expect, it } from "vitest";
import { wrapCaption } from "../../src/preview/captions";
import { sceneFrameCounts } from "../../src/domain/timeline";
import { createScene } from "../../src/domain/project";

describe("caption composition", () => {
  it("preserves line breaks and wraps long words without splitting surrogate pairs", () => {
    const measure = (text: string) => [...text].length;
    expect(wrapCaption("Hello\nfamily", 12, measure)).toEqual([
      "Hello",
      "family",
    ]);
    expect(wrapCaption("one two three", 7, measure)).toEqual([
      "one two",
      "three",
    ]);
    expect(wrapCaption("🌲🌲🌲🌲", 2, measure)).toEqual(["🌲🌲", "🌲🌲"]);
  });

  it("bounds overflowing captions to four lines with a visible ellipsis", () => {
    expect(wrapCaption("a\nb\nc\nd\ne", 4, (text) => text.length)).toEqual([
      "a",
      "b",
      "c",
      "d…",
    ]);
  });
});

describe("native frame timing", () => {
  it("quantizes cumulative boundaries so rounding cannot accumulate across hundreds of short scenes", () => {
    const scenes = Array.from({ length: 300 }, () => ({
      ...createScene(null),
      duration: 0.25,
    }));
    const frames = sceneFrameCounts(scenes);
    expect(frames.reduce((total, count) => total + count, 0)).toBe(2250);
    expect(frames.slice(0, 4)).toEqual([8, 7, 8, 7]);
    expect(sceneFrameCounts([])).toEqual([]);
  });
});
