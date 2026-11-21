import type { Scene } from "../../contracts/project";
import type { CameraPose } from "./composition";

/** The camera never zooms beyond what the project schema and export allow. */
export const ZOOM_LIMITS = { min: 1, max: 6 } as const;

/** A camera pose as a rectangle in fractions of the oriented photo. */
export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

/**
 * Converts between camera poses (focus + zoom, as mediaPlacement uses them)
 * and the rectangle of the photo they show. At zoom 1 the frame covers
 * target / (photo × fit scale) of the photo; focus is the share of the spare
 * space left of (or above) the frame. Both directions are O(1).
 */
export function frameGeometry(
  photoWidth: number,
  photoHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: Scene["fit"],
) {
  const scale = (fit === "cover" ? Math.max : Math.min)(
    targetWidth / photoWidth,
    targetHeight / photoHeight,
  );
  const baseWidth = targetWidth / (photoWidth * scale);
  const baseHeight = targetHeight / (photoHeight * scale);
  const toRect = (pose: CameraPose): FrameRect => {
    const width = baseWidth / pose.zoom;
    const height = baseHeight / pose.zoom;
    return {
      width,
      height,
      left: (1 - width) * pose.focusX,
      top: (1 - height) * pose.focusY,
    };
  };
  const toPose = (rect: FrameRect): CameraPose => ({
    zoom: clamp(baseWidth / rect.width, ZOOM_LIMITS.min, ZOOM_LIMITS.max),
    focusX: rect.width === 1 ? 0.5 : clamp(rect.left / (1 - rect.width), 0, 1),
    focusY: rect.height === 1 ? 0.5 : clamp(rect.top / (1 - rect.height), 0, 1),
  });
  /** Keeps a dragged frame the right shape, inside the photo and within zoom limits. */
  const constrain = (rect: FrameRect): FrameRect => {
    const smallest = toRect({
      focusX: 0.5,
      focusY: 0.5,
      zoom: ZOOM_LIMITS.max,
    });
    const largest = toRect({ focusX: 0.5, focusY: 0.5, zoom: ZOOM_LIMITS.min });
    const width = clamp(rect.width, smallest.width, largest.width);
    const height = (width / largest.width) * largest.height;
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    return {
      width,
      height,
      // A contained photo can be smaller than its frame along one axis.
      // Its focus then spans a negative offset up to zero.
      left: clamp(
        centreX - width / 2,
        Math.min(0, 1 - width),
        Math.max(0, 1 - width),
      ),
      top: clamp(
        centreY - height / 2,
        Math.min(0, 1 - height),
        Math.max(0, 1 - height),
      ),
    };
  };
  return { toRect, toPose, constrain };
}
