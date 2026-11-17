import type { Scene } from "../../contracts/project";
import { fadeOpacity } from "../domain/timeline";
import { cameraPose, mediaPlacement } from "../domain/composition";
import { canvasColourFilter } from "./colour-filter";
import type { VisualMedia } from "../media/import";
import { drawCaption } from "./captions";
import { drawText } from "./text";
import { drawLayer } from "./layers";
import { effectSource } from "./effects";

/** Composite a single source and title; media aspect ratio is always preserved. */
export function renderFrame(
  context: CanvasRenderingContext2D,
  scene: Scene,
  media: VisualMedia | null,
  localTime: number,
  animateFade = true,
  resolveMedia: (id: string, reference?: string) => VisualMedia | null = () =>
    null,
): void {
  const { width, height } = context.canvas;
  context.globalAlpha = 1;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  context.save();
  context.globalAlpha = animateFade ? fadeOpacity(scene, localTime) : 1;
  context.fillStyle = scene.background;
  if (scene.backdrop.kind === "gradient") {
    const angle = (scene.backdrop.angle * Math.PI) / 180;
    const gradient = context.createLinearGradient(
      width / 2 - (Math.cos(angle) * width) / 2,
      height / 2 - (Math.sin(angle) * height) / 2,
      width / 2 + (Math.cos(angle) * width) / 2,
      height / 2 + (Math.sin(angle) * height) / 2,
    );
    gradient.addColorStop(0, scene.background);
    gradient.addColorStop(1, scene.backdrop.secondColour);
    context.fillStyle = gradient;
  }
  context.fillRect(0, 0, width, height);
  const backdrop = scene.backdrop.assetId
    ? resolveMedia(scene.backdrop.assetId, "backdrop")
    : null;
  if (scene.backdrop.kind === "photo" && backdrop) {
    const sourceWidth =
      backdrop instanceof HTMLVideoElement
        ? backdrop.videoWidth
        : backdrop.naturalWidth;
    const sourceHeight =
      backdrop instanceof HTMLVideoElement
        ? backdrop.videoHeight
        : backdrop.naturalHeight;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    context.drawImage(
      backdrop,
      (width - sourceWidth * scale) / 2,
      (height - sourceHeight * scale) / 2,
      sourceWidth * scale,
      sourceHeight * scale,
    );
  }
  if (media) {
    const processed = effectSource(
      media,
      scene.adjustments,
      scene.keyColour,
      scene.keyTolerance,
    );
    const sourceWidth =
      media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const sourceHeight =
      media instanceof HTMLVideoElement
        ? media.videoHeight
        : media.naturalHeight;
    const rectangle = mediaPlacement(
      sourceWidth,
      sourceHeight,
      width,
      height,
      scene.fit,
      scene.transform,
      cameraPose(scene, localTime),
    );
    const draw = (background: boolean) => {
      const placement = background
        ? mediaPlacement(
            sourceWidth,
            sourceHeight,
            width,
            height,
            "cover",
            scene.transform,
            { focusX: 0.5, focusY: 0.5, zoom: 1.08 },
          )
        : rectangle;
      context.save();
      const filter =
        processed === media ? canvasColourFilter(scene.adjustments) : "none";
      context.filter = background
        ? `${filter === "none" ? "" : filter + " "}blur(${Math.max(2, Math.min(width, height) * 0.035)}px)`
        : filter;
      context.translate(placement.centerX, placement.centerY);
      context.scale(placement.flipX ? -1 : 1, placement.flipY ? -1 : 1);
      context.rotate((placement.rotation * Math.PI) / 180);
      context.drawImage(
        processed,
        (-sourceWidth * placement.scale) / 2,
        (-sourceHeight * placement.scale) / 2,
        sourceWidth * placement.scale,
        sourceHeight * placement.scale,
      );
      context.restore();
    };
    if (scene.backdrop.kind === "blur") draw(true);
    draw(false);
  }
  drawCaption(context, scene, width, height);
  for (const layer of scene.layers)
    drawLayer(
      context,
      layer,
      scene.duration,
      localTime,
      layer.assetId ? resolveMedia(layer.assetId, layer.id) : null,
    );
  for (const item of scene.textItems)
    drawText(context, item, scene.duration, localTime);
  context.restore();
}
