import type { Scene, Transform } from "../../contracts/project";

export interface CameraPose {
  focusX: number;
  focusY: number;
  zoom: number;
}
export interface MediaPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

/** Resolve the camera independently of the browser and encoder. */
export function cameraEndpoints(scene: Scene): {
  from: CameraPose;
  to: CameraPose;
} {
  const settings = scene.transform;
  const from = {
    focusX: settings.focusX,
    focusY: settings.focusY,
    zoom: settings.zoom,
  };
  const to = { ...from };
  const constrain = (value: number) => Math.max(0, Math.min(1, value));
  const motionZoom = 1.15;
  const panTravel = 0.2;
  switch (settings.motion) {
    case "custom":
      return {
        from,
        to: {
          focusX: settings.endFocusX,
          focusY: settings.endFocusY,
          zoom: settings.endZoom,
        },
      };
    case "zoom-in":
      to.zoom = Math.min(6, from.zoom * motionZoom);
      break;
    case "zoom-out":
      from.zoom = Math.min(6, from.zoom * motionZoom);
      break;
    case "pan-left":
    case "pan-right": {
      const direction = settings.motion === "pan-right" ? 1 : -1;
      from.focusX = constrain(settings.focusX - panTravel * direction);
      to.focusX = constrain(settings.focusX + panTravel * direction);
      from.zoom = to.zoom = Math.max(motionZoom, from.zoom);
      break;
    }
    case "pan-up":
    case "pan-down": {
      const direction = settings.motion === "pan-down" ? 1 : -1;
      from.focusY = constrain(settings.focusY - panTravel * direction);
      to.focusY = constrain(settings.focusY + panTravel * direction);
      from.zoom = to.zoom = Math.max(motionZoom, from.zoom);
      break;
    }
  }
  return { from, to };
}

/** Interpolate stored/preset endpoints with no frame-time randomness. */
export function cameraPose(scene: Scene, time: number): CameraPose {
  const { from, to } = cameraEndpoints(scene);
  const progress = Math.max(0, Math.min(1, time / scene.duration));
  const interpolate = (start: number, end: number) =>
    start + (end - start) * progress;
  return {
    focusX: interpolate(from.focusX, to.focusX),
    focusY: interpolate(from.focusY, to.focusY),
    zoom: interpolate(from.zoom, to.zoom),
  };
}

/** Place oriented media without changing its source bytes. */
export function mediaPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: Scene["fit"],
  transform: Transform,
  pose: CameraPose,
): MediaPlacement {
  const quarterTurn = transform.rotation === 90 || transform.rotation === 270;
  const orientedWidth = quarterTurn ? sourceHeight : sourceWidth;
  const orientedHeight = quarterTurn ? sourceWidth : sourceHeight;
  if (orientedWidth <= 0 || orientedHeight <= 0)
    throw new Error("Media dimensions must be positive");
  const scale =
    (fit === "cover" ? Math.max : Math.min)(
      targetWidth / orientedWidth,
      targetHeight / orientedHeight,
    ) * pose.zoom;
  const width = orientedWidth * scale;
  const height = orientedHeight * scale;
  const x = (targetWidth - width) * pose.focusX;
  const y = (targetHeight - height) * pose.focusY;
  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    scale,
    rotation: transform.rotation,
    flipX: transform.flipX,
    flipY: transform.flipY,
  };
}

/** Stable overlap semantics are shared by UI timing, audio and encoded segments. */
export function transitionOverlap(
  scene: Pick<Scene, "duration" | "transition" | "transitionSeconds">,
  next?: Pick<Scene, "duration">,
): number {
  if (!next || scene.transition === "cut" || scene.transition === "fade")
    return 0;
  return Math.max(
    0,
    Math.min(scene.transitionSeconds, scene.duration / 2, next.duration / 2),
  );
}
