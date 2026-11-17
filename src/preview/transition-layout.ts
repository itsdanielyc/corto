import type { Scene } from "../../contracts/project";

/** How one of the two pictures in a transition is drawn, relative to the full frame. */
export interface PictureDraw {
  /** Horizontal offset in pixels. */
  dx: number;
  /** Vertical offset in pixels. */
  dy: number;
  /** Scale about the frame centre. */
  scale: number;
  alpha: number;
  /** Gaussian blur radius in pixels. */
  blur: number;
}

export interface TransitionLayout {
  outgoing: PictureDraw;
  incoming: PictureDraw;
  /** Whether the incoming picture is painted over the outgoing one. */
  incomingOnTop: boolean;
}

/** Below this the zoom transition's outgoing picture is a single magnified point. */
const MINIMUM_ZOOM_FRACTION = 0.01;
/** Standard deviation of a box blur of width 1, used to match FFmpeg's box blur. */
const BOX_TO_GAUSSIAN = 1 / Math.sqrt(12);

const still = (alpha = 1): PictureDraw => ({
  dx: 0,
  dy: 0,
  scale: 1,
  alpha,
  blur: 0,
});

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The preview geometry for an overlapping transition, mirroring FFmpeg's
 * `xfade` effect that export uses for the same kind, so the preview shows what
 * the movie will contain. `progress` runs from 0 (all outgoing) to 1 (all
 * incoming). Fade-to-white and wipes are drawn separately by the compositor.
 */
export function transitionLayout(
  transition: Scene["transition"],
  progress: number,
  width: number,
  height: number,
): TransitionLayout {
  const p = Math.min(1, Math.max(0, progress));
  switch (transition) {
    // xfade slideleft/slideright/slideup: both pictures travel together.
    case "slide-left":
      return {
        outgoing: { ...still(), dx: -p * width },
        incoming: { ...still(), dx: (1 - p) * width },
        incomingOnTop: true,
      };
    case "slide-right":
      return {
        outgoing: { ...still(), dx: p * width },
        incoming: { ...still(), dx: -(1 - p) * width },
        incomingOnTop: true,
      };
    case "push-up":
      return {
        outgoing: { ...still(), dy: -p * height },
        incoming: { ...still(), dy: (1 - p) * height },
        incomingOnTop: true,
      };
    // xfade zoomin: the outgoing picture zooms into its centre during the first
    // half, then fades to the incoming picture during the second.
    case "zoom": {
      const remaining = 1 - p;
      const fraction = Math.max(
        MINIMUM_ZOOM_FRACTION,
        smoothstep(0.5, 1, remaining),
      );
      return {
        outgoing: {
          ...still(smoothstep(0, 0.5, remaining)),
          scale: 1 / fraction,
        },
        incoming: still(),
        incomingOnTop: false,
      };
    }
    // xfade hblur: both pictures blur most at the midpoint while crossfading.
    case "blur": {
      const peak = 2 * Math.min(p, 1 - p);
      const blur = (1 + (width / 2) * peak) * BOX_TO_GAUSSIAN;
      return {
        outgoing: { ...still(), blur },
        incoming: { ...still(p), blur },
        incomingOnTop: true,
      };
    }
    default:
      return { outgoing: still(), incoming: still(p), incomingOnTop: true };
  }
}
