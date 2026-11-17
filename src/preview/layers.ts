import type { VisualLayer } from "../../contracts/project";
import type { VisualMedia } from "../media/import";
import { effectSource } from "./effects";
const ORIGINAL_COLOUR = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  look: "none",
} as const;

/** Simple geometric stickers remain crisp, local and independent of system emoji fonts. */
export function shapePath(
  context: CanvasRenderingContext2D,
  shape: VisualLayer["shape"],
  width: number,
  height: number,
): void {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  context.beginPath();
  if (shape === "ellipse" || shape === "balloon")
    context.ellipse(0, 0, halfWidth, halfHeight, 0, 0, Math.PI * 2);
  else if (shape === "heart") {
    context.moveTo(0, halfHeight);
    context.bezierCurveTo(-width, 0, -halfWidth, -height, 0, -height * 0.2);
    context.bezierCurveTo(halfWidth, -height, width, 0, 0, halfHeight);
  } else if (["star", "sparkle", "flower", "confetti"].includes(shape)) {
    const points = shape === "sparkle" ? 4 : shape === "flower" ? 8 : 5;
    for (let index = 0; index < points * 2; index++) {
      const angle = (index * Math.PI) / points - Math.PI / 2;
      const radius = index % 2 ? 0.42 : 1;
      const x = Math.cos(angle) * halfWidth * radius;
      const y = Math.sin(angle) * halfHeight * radius;
      if (!index) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  } else if (shape === "arrow") {
    context.moveTo(-halfWidth, -height * 0.16);
    context.lineTo(width * 0.1, -height * 0.16);
    context.lineTo(width * 0.1, -halfHeight);
    context.lineTo(halfWidth, 0);
    context.lineTo(width * 0.1, halfHeight);
    context.lineTo(width * 0.1, height * 0.16);
    context.lineTo(-halfWidth, height * 0.16);
    context.closePath();
  } else
    context.rect(
      -halfWidth,
      shape === "line" ? -height * 0.04 : -halfHeight,
      width,
      shape === "line" ? height * 0.08 : height,
    );
}

/** Composite a bounded overlay with linear start/end motion. */
export function drawLayer(
  context: CanvasRenderingContext2D,
  layer: VisualLayer,
  duration: number,
  time: number,
  media: VisualMedia | null,
): void {
  const end = layer.end ?? duration;
  if (time < layer.start || time >= end) return;
  const progress = (time - layer.start) / (end - layer.start);
  const interpolate = (from: number, to: number) =>
    from + (to - from) * progress;
  const scale = interpolate(1, layer.endScale);
  const width = context.canvas.width * layer.width * scale;
  const height = context.canvas.height * layer.height * scale;
  context.save();
  context.translate(
    context.canvas.width * interpolate(layer.x, layer.endX ?? layer.x),
    context.canvas.height * interpolate(layer.y, layer.endY ?? layer.y),
  );
  context.rotate((layer.rotation * Math.PI) / 180);
  context.globalAlpha *= interpolate(
    layer.opacity,
    layer.endOpacity ?? layer.opacity,
  );
  if (media) {
    const sourceWidth =
      media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const sourceHeight =
      media instanceof HTMLVideoElement
        ? media.videoHeight
        : media.naturalHeight;
    const fitScale = (layer.fit === "cover" ? Math.max : Math.min)(
      width / sourceWidth,
      height / sourceHeight,
    );
    context.beginPath();
    context.rect(-width / 2, -height / 2, width, height);
    context.clip();
    context.drawImage(
      effectSource(media, ORIGINAL_COLOUR, layer.keyColour, layer.keyTolerance),
      (-sourceWidth * fitScale) / 2,
      (-sourceHeight * fitScale) / 2,
      sourceWidth * fitScale,
      sourceHeight * fitScale,
    );
  } else if (layer.kind !== "media") {
    shapePath(context, layer.shape, width, height);
    context.fillStyle = layer.colour;
    context.strokeStyle = layer.stroke;
    context.lineWidth =
      layer.strokeWidth * Math.min(context.canvas.width, context.canvas.height);
    context.fill();
    if (layer.strokeWidth) context.stroke();
  }
  context.restore();
}
