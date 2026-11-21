import { describe, expect, it } from "vitest";
import { frameGeometry, ZOOM_LIMITS } from "../../src/domain/framing";
import { mediaPlacement } from "../../src/domain/composition";
import { describeDrop } from "../../src/components/drop-summary";
import {
  isThemeChoice,
  THEME_CHOICES,
  windowFrameFor,
} from "../../contracts/platform";
import { transformSchema } from "../../contracts/creative";

const transform = {
  rotation: 0 as const,
  flipX: false,
  flipY: false,
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
  endFocusX: 0.5,
  endFocusY: 0.5,
  endZoom: 1,
  motion: "custom" as const,
};

describe("framing on the picture", () => {
  // A portrait phone photo in a 16:9 film: the frame is a band across the photo.
  const photo = { width: 3000, height: 4000 };
  const film = { width: 1280, height: 720 };
  const geometry = frameGeometry(
    photo.width,
    photo.height,
    film.width,
    film.height,
    "cover",
  );

  it("draws exactly the part of the photo the renderer shows", () => {
    const pose = { focusX: 0.3, focusY: 0.8, zoom: 2 };
    const rect = geometry.toRect(pose);
    const placement = mediaPlacement(
      photo.width,
      photo.height,
      film.width,
      film.height,
      "cover",
      transform,
      pose,
    );
    // The visible window in photo fractions, measured from the placement.
    expect(rect.left).toBeCloseTo(-placement.x / placement.width, 6);
    expect(rect.top).toBeCloseTo(-placement.y / placement.height, 6);
    expect(rect.width).toBeCloseTo(film.width / placement.width, 6);
    expect(rect.height).toBeCloseTo(film.height / placement.height, 6);
  });

  it("turns a dragged rectangle back into a pose that shows the same rectangle", () => {
    // Where the frame spans the whole photo on an axis, focus on that axis
    // has no effect; the drawn rectangle is what must survive the round trip.
    for (const pose of [
      { focusX: 0, focusY: 0, zoom: 1 },
      { focusX: 0.25, focusY: 0.9, zoom: 1.6 },
      { focusX: 1, focusY: 0.5, zoom: 4 },
    ]) {
      const rect = geometry.toRect(pose);
      const back = geometry.toRect(geometry.toPose(rect));
      expect(geometry.toPose(rect).zoom).toBeCloseTo(pose.zoom, 6);
      for (const key of ["left", "top", "width", "height"] as const)
        expect(back[key]).toBeCloseTo(rect[key], 6);
    }
  });

  it("keeps a dragged frame inside the photo, in shape and within zoom limits", () => {
    const largest = geometry.toRect({ focusX: 0.5, focusY: 0.5, zoom: 1 });
    const outside = geometry.constrain({
      left: 0.9,
      top: -0.4,
      width: largest.width * 3,
      height: largest.height * 3,
    });
    expect(outside.width).toBeCloseTo(largest.width, 6);
    expect(outside.height / outside.width).toBeCloseTo(
      largest.height / largest.width,
      6,
    );
    expect(outside.left).toBeGreaterThanOrEqual(0);
    expect(outside.top).toBeGreaterThanOrEqual(0);
    expect(outside.top + outside.height).toBeLessThanOrEqual(1 + 1e-9);
    const tiny = geometry.constrain({
      left: 0.5,
      top: 0.5,
      width: 0.001,
      height: 0.001,
    });
    expect(geometry.toPose(tiny).zoom).toBeCloseTo(ZOOM_LIMITS.max, 6);
  });

  it("allows exactly the zoom range the project schema accepts", () => {
    // A frame dragged to either limit must still save and reopen.
    const parses = (zoom: number) =>
      transformSchema.safeParse({ ...transform, zoom, endZoom: zoom }).success;
    expect(parses(ZOOM_LIMITS.min)).toBe(true);
    expect(parses(ZOOM_LIMITS.max)).toBe(true);
    expect(parses(ZOOM_LIMITS.min - 0.01)).toBe(false);
    expect(parses(ZOOM_LIMITS.max + 0.01)).toBe(false);
  });

  it("preserves off-centre framing when fitting a letterboxed or pillarboxed photo", () => {
    for (const [width, height] of [
      [1000, 2000],
      [3000, 1000],
    ]) {
      const fit = frameGeometry(
        width,
        height,
        film.width,
        film.height,
        "contain",
      );
      const pose = { focusX: 0.17, focusY: 0.83, zoom: 1.1 };
      const rect = fit.toRect(pose);
      const restored = fit.toPose(fit.constrain(rect));
      expect(restored.focusX).toBeCloseTo(pose.focusX);
      expect(restored.focusY).toBeCloseTo(pose.focusY);
      expect(restored.zoom).toBeCloseTo(pose.zoom);
    }
  });
});

describe("appearance across the native boundary", () => {
  it("accepts the three choices and nothing that merely resembles one", () => {
    for (const choice of THEME_CHOICES)
      expect(isThemeChoice(choice)).toBe(true);
    for (const malformed of [
      null,
      undefined,
      "",
      "Dark",
      "dark ",
      "auto",
      0,
      1,
      true,
      ["dark"],
      { theme: "dark" },
      new Date(0),
      new String("dark"),
    ])
      expect(isThemeChoice(malformed), String(malformed)).toBe(false);
  });

  it("gives each operating system the frame its window is built with", () => {
    expect(windowFrameFor("darwin")).toBe("mac");
    expect(windowFrameFor("win32")).toBe("windows");
    expect(windowFrameFor("linux")).toBe("system");
    // Anything unrecognised keeps the system frame rather than hiding it.
    expect(windowFrameFor("freebsd")).toBe("system");
  });
});

describe("drop summary", () => {
  const items = (...types: string[]) =>
    types.map((type) => ({
      kind: "file",
      type,
    })) as unknown as DataTransferItemList;
  const t = (text: string) => text;

  it("names what a drag will add, by kind", () => {
    expect(
      describeDrop(
        items("image/jpeg", "image/png", "video/mp4", "audio/mpeg", ""),
        t,
      ),
    ).toBe("Drop to add 2 photos, 1 clip, 1 song and 1 file");
    expect(describeDrop(items("image/heic"), t)).toBe("Drop to add 1 photo");
  });

  it("says nothing for drags without files", () => {
    expect(
      describeDrop(
        [
          { kind: "string", type: "text/plain" },
        ] as unknown as DataTransferItemList,
        t,
      ),
    ).toBe("");
  });
});
