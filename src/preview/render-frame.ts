import type { Scene } from "../../contracts/project";
import { fadeOpacity, fitRect } from "../domain/timeline";
import type { VisualMedia } from "../media/import";
import { drawCaption } from "./captions";

/** Composite a single source and title; media aspect ratio is always preserved. */
export function renderFrame(
  context: CanvasRenderingContext2D,
  scene: Scene,
  media: VisualMedia | null,
  localTime: number,
  animateFade = true,
): void {
  const { width, height } = context.canvas;
  context.globalAlpha = 1;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  context.save();
  context.globalAlpha = animateFade ? fadeOpacity(scene, localTime) : 1;
  context.fillStyle = scene.background;
  context.fillRect(0, 0, width, height);
  if (media) {
    const sourceWidth =
      media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const sourceHeight =
      media instanceof HTMLVideoElement
        ? media.videoHeight
        : media.naturalHeight;
    const rectangle = fitRect(
      sourceWidth,
      sourceHeight,
      width,
      height,
      scene.fit,
    );
    context.drawImage(
      media,
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    );
  }
  drawCaption(context, scene, width, height);
  context.restore();
}
