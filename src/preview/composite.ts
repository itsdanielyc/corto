import type { Project, Scene } from "../../contracts/project";
import type { VisualMedia } from "../media/import";
import { buildTimeline, locateComposition } from "../domain/timeline";
import { renderFrame } from "./render-frame";
import { drawSubtitle } from "./subtitles";
import { subtitleAt } from "../domain/subtitles";
import { transitionLayout, type PictureDraw } from "./transition-layout";

const buffers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement[]>();
const timelines = new WeakMap<
  Project["scenes"],
  ReturnType<typeof buildTimeline>
>();
export const sceneMediaKey = (
  scene: Scene,
  assetId: string,
  reference = "",
): string => `${scene.id}:${assetId}${reference ? `:${reference}` : ""}`;

/** Blend at most two adjacent scenes; buffers are reused rather than allocated each frame. */
export function renderProjectFrame(
  context: CanvasRenderingContext2D,
  project: Project,
  time: number,
  media: ReadonlyMap<string, VisualMedia>,
  animate = true,
): void {
  let timeline = timelines.get(project.scenes);
  if (!timeline) {
    timeline = buildTimeline(project.scenes);
    timelines.set(project.scenes, timeline);
  }
  const located = locateComposition(timeline, time);
  if (!located) return;
  const { width, height } = context.canvas;
  const draw = (
    target: CanvasRenderingContext2D,
    scene: Scene,
    localTime: number,
  ) =>
    renderFrame(
      target,
      scene,
      scene.assetId
        ? (media.get(sceneMediaKey(scene, scene.assetId)) ?? null)
        : null,
      localTime,
      animate,
      (id, reference) => media.get(sceneMediaKey(scene, id, reference)) ?? null,
    );
  if (!located.to) draw(context, located.from.scene, located.from.localTime);
  else {
    let canvases = buffers.get(context.canvas);
    if (!canvases) {
      canvases = [
        document.createElement("canvas"),
        document.createElement("canvas"),
      ];
      buffers.set(context.canvas, canvases);
    }
    for (const canvas of canvases)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    draw(
      canvases[0].getContext("2d")!,
      located.from.scene,
      located.from.localTime,
    );
    draw(canvases[1].getContext("2d")!, located.to.scene, located.to.localTime);
    const progress = located.progress;
    const transition = located.from.scene.transition;
    context.save();
    context.globalAlpha = 1;
    context.filter = "none";
    if (transition !== "fade-white" && !transition.startsWith("wipe")) {
      const layout = transitionLayout(transition, progress, width, height);
      const pictures: [HTMLCanvasElement, PictureDraw][] = [
        [canvases[0], layout.outgoing],
        [canvases[1], layout.incoming],
      ];
      if (!layout.incomingOnTop) pictures.reverse();
      context.fillStyle = "#000000";
      context.fillRect(0, 0, width, height);
      for (const [picture, placement] of pictures)
        paintPicture(context, picture, placement);
    } else {
      context.drawImage(canvases[0], 0, 0);
      paintEdgeTransition(context, canvases[1], transition, progress);
    }
    context.restore();
  }
  drawSubtitle(
    context,
    subtitleAt(project.subtitles, time),
    project.subtitleStyle,
  );
}

function paintPicture(
  context: CanvasRenderingContext2D,
  picture: HTMLCanvasElement,
  placement: PictureDraw,
): void {
  const { width, height } = context.canvas;
  if (placement.blur) picture = blurredWithinFrame(picture, placement.blur);
  context.save();
  context.globalAlpha = placement.alpha;
  context.translate(width / 2 + placement.dx, height / 2 + placement.dy);
  context.scale(placement.scale, placement.scale);
  context.drawImage(picture, -width / 2, -height / 2);
  context.restore();
}

const blurBuffers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/**
 * Canvas blur samples transparent pixels beyond the frame, darkening the edges.
 * FFmpeg's blur stays inside the picture, so blur over a sharp copy instead.
 */
function blurredWithinFrame(
  picture: HTMLCanvasElement,
  radius: number,
): HTMLCanvasElement {
  let buffer = blurBuffers.get(picture);
  if (!buffer) {
    buffer = document.createElement("canvas");
    blurBuffers.set(picture, buffer);
  }
  if (buffer.width !== picture.width || buffer.height !== picture.height) {
    buffer.width = picture.width;
    buffer.height = picture.height;
  }
  const target = buffer.getContext("2d")!;
  target.filter = "none";
  target.drawImage(picture, 0, 0);
  target.filter = `blur(${radius}px)`;
  target.drawImage(picture, 0, 0);
  target.filter = "none";
  return buffer;
}

/** Fade-to-white and wipes, drawn over the outgoing picture already on the canvas. */
function paintEdgeTransition(
  context: CanvasRenderingContext2D,
  incoming: HTMLCanvasElement,
  transition: Scene["transition"],
  progress: number,
): void {
  const { width, height } = context.canvas;
  if (transition === "fade-white") {
    context.fillStyle = "#ffffff";
    context.globalAlpha = progress < 0.5 ? progress * 2 : 1;
    context.fillRect(0, 0, width, height);
    context.globalAlpha = Math.max(0, progress * 2 - 1);
    context.drawImage(incoming, 0, 0);
    return;
  }
  context.beginPath();
  context.rect(
    transition === "wipe-left" ? width * (1 - progress) : 0,
    0,
    width * progress,
    height,
  );
  context.clip();
  context.drawImage(incoming, 0, 0);
}
