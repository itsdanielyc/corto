import { describe, expect, it } from "vitest";
import {
  transitionLayout,
  type TransitionLayout,
} from "../../src/preview/transition-layout";

const WIDTH = 1280;
const HEIGHT = 720;

/** Which picture is visible at a point, for layouts without scaling or partial alpha. */
function pictureAt(
  layout: TransitionLayout,
  x: number,
  y: number,
): "outgoing" | "incoming" {
  const inside = (draw: TransitionLayout["incoming"]) =>
    x >= draw.dx && x < draw.dx + WIDTH && y >= draw.dy && y < draw.dy + HEIGHT;
  if (inside(layout.incoming) && layout.incoming.alpha === 1) return "incoming";
  return "outgoing";
}

describe("preview transition layout matches FFmpeg xfade", () => {
  it("slides both pictures left, bringing the new one in from the right", () => {
    const layout = transitionLayout("slide-left", 0.25, WIDTH, HEIGHT);
    expect(layout.outgoing.dx).toBe(-0.25 * WIDTH);
    expect(layout.incoming.dx).toBe(0.75 * WIDTH);
    expect(pictureAt(layout, 0.1 * WIDTH, HEIGHT / 2)).toBe("outgoing");
    expect(pictureAt(layout, 0.9 * WIDTH, HEIGHT / 2)).toBe("incoming");
  });

  it("slides both pictures right, bringing the new one in from the left", () => {
    const layout = transitionLayout("slide-right", 0.25, WIDTH, HEIGHT);
    expect(layout.outgoing.dx).toBe(0.25 * WIDTH);
    expect(layout.incoming.dx).toBe(-0.75 * WIDTH);
  });

  it("pushes both pictures up, bringing the new one in from the bottom", () => {
    const layout = transitionLayout("push-up", 0.25, WIDTH, HEIGHT);
    expect(layout.outgoing.dy).toBe(-0.25 * HEIGHT);
    expect(layout.incoming.dy).toBe(0.75 * HEIGHT);
    expect(pictureAt(layout, WIDTH / 2, 0.9 * HEIGHT)).toBe("incoming");
  });

  it("zooms into the outgoing picture before fading to the new one", () => {
    const early = transitionLayout("zoom", 0.25, WIDTH, HEIGHT);
    expect(early.incomingOnTop).toBe(false);
    expect(early.outgoing.alpha).toBe(1);
    expect(early.outgoing.scale).toBeGreaterThan(1);
    const late = transitionLayout("zoom", 0.75, WIDTH, HEIGHT);
    expect(late.outgoing.alpha).toBeGreaterThan(0);
    expect(late.outgoing.alpha).toBeLessThan(1);
    expect(transitionLayout("zoom", 1, WIDTH, HEIGHT).outgoing.alpha).toBe(0);
  });

  it("blurs both pictures most at the midpoint while crossfading", () => {
    const middle = transitionLayout("blur", 0.5, WIDTH, HEIGHT);
    const edge = transitionLayout("blur", 0.1, WIDTH, HEIGHT);
    expect(middle.outgoing.blur).toBe(middle.incoming.blur);
    expect(middle.outgoing.blur).toBeGreaterThan(edge.outgoing.blur);
    expect(middle.incoming.alpha).toBe(0.5);
  });

  it("crossfades for a dissolve", () => {
    const layout = transitionLayout("dissolve", 0.3, WIDTH, HEIGHT);
    expect(layout.outgoing).toMatchObject({ dx: 0, dy: 0, alpha: 1 });
    expect(layout.incoming).toMatchObject({ dx: 0, dy: 0, alpha: 0.3 });
  });
});
