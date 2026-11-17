import type { Project, Scene } from "../../contracts/project";
import type { VisualMedia } from "../media/import";
import { buildTimeline, locateComposition } from "../domain/timeline";
import { renderFrame } from "./render-frame";
import { drawSubtitle } from "./subtitles";
import { subtitleAt } from "../domain/subtitles";

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
    context.drawImage(canvases[0], 0, 0);
    if (transition === "fade-white") {
      context.fillStyle = "#ffffff";
      context.globalAlpha = progress < 0.5 ? progress * 2 : 1;
      context.fillRect(0, 0, width, height);
      context.globalAlpha = Math.max(0, progress * 2 - 1);
      context.drawImage(canvases[1], 0, 0);
    } else if (transition.startsWith("wipe")) {
      context.beginPath();
      context.rect(
        transition === "wipe-left" ? width * (1 - progress) : 0,
        0,
        width * progress,
        height,
      );
      context.clip();
      context.drawImage(canvases[1], 0, 0);
    } else if (transition.startsWith("slide") || transition === "push-up") {
      const x =
        transition === "push-up"
          ? 0
          : (transition === "slide-left" ? 1 : -1) * width * (1 - progress);
      const y = transition === "push-up" ? height * (1 - progress) : 0;
      context.drawImage(canvases[1], x, y);
    } else {
      context.globalAlpha = progress;
      if (transition === "blur")
        context.filter = `blur(${Math.sin(progress * Math.PI) * height * 0.025}px)`;
      if (transition === "zoom") {
        const scale = 0.8 + 0.2 * progress;
        context.translate(width / 2, height / 2);
        context.scale(scale, scale);
        context.translate(-width / 2, -height / 2);
      }
      context.drawImage(canvases[1], 0, 0);
    }
    context.restore();
  }
  drawSubtitle(
    context,
    subtitleAt(project.subtitles, time),
    project.subtitleStyle,
  );
}
