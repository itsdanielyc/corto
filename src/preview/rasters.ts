import type { RenderRaster } from "../../contracts/services";
import type {
  ExportResolution,
  Project,
  TextItem,
} from "../../contracts/project";
import { frameDimensions } from "../domain/timeline";
import { drawCaption, loadCaptionFonts } from "./captions";
import { drawSubtitle } from "./subtitles";
import { drawLayer } from "./layers";
import { layoutText, textFont } from "./text";
import { renderFrame } from "./render-frame";

async function raster(
  key: string,
  canvas: HTMLCanvasElement,
): Promise<RenderRaster> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("A render layer could not be prepared")),
      "image/png",
    ),
  );
  return {
    key,
    width: canvas.width,
    height: canvas.height,
    png: new Uint8Array(await blob.arrayBuffer()),
  };
}

/** Render natural-height text, including long credits, instead of clipping a full-frame image. */
function textCanvas(
  item: TextItem,
  frameWidth: number,
  frameHeight: number,
  mask: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const layout = layoutText(context, item, frameWidth, frameHeight);
  const padding = Math.ceil(
    layout.fontSize * 0.5 + frameHeight * item.outlineWidth * 2,
  );
  canvas.width = Math.ceil(layout.width + padding * 2);
  canvas.height = Math.max(1, Math.ceil(layout.height + padding * 2));
  if (canvas.width * canvas.height > 32 * 1024 ** 2 || canvas.height > 32768)
    throw new Error(
      "Reduce the credits font size or split this text into sections",
    );
  context.font = textFont(item, layout.fontSize);
  context.textBaseline = "middle";
  context.textAlign = item.align;
  const anchor =
    item.align === "left"
      ? padding
      : item.align === "right"
        ? canvas.width - padding
        : canvas.width / 2;
  if (mask) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "left";
  } else {
    if (item.boxOpacity) {
      context.globalAlpha = item.boxOpacity;
      context.fillStyle = item.boxColour;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalAlpha = 1;
    }
    context.fillStyle = item.colour;
    context.strokeStyle = item.outline;
    context.lineWidth = frameHeight * item.outlineWidth * 2;
    context.lineJoin = "round";
    if (item.shadow) {
      context.shadowColor = "#00000099";
      context.shadowBlur = layout.fontSize * 0.2;
      context.shadowOffsetY = layout.fontSize * 0.05;
    }
  }
  let characters = 0;
  const total = Math.max(
    1,
    layout.lines.reduce((sum, line) => sum + [...line].length + 1, 0),
  );
  for (const [index, line] of layout.lines.entries()) {
    const baseline = padding + (index + 0.5) * layout.lineHeight;
    if (!mask) {
      if (item.outlineWidth) context.strokeText(line, anchor, baseline);
      context.fillText(line, anchor, baseline);
    } else {
      let left =
        anchor -
        (item.align === "center"
          ? context.measureText(line).width / 2
          : item.align === "right"
            ? context.measureText(line).width
            : 0);
      let prefix = "";
      for (const character of line) {
        const previous = context.measureText(prefix).width;
        prefix += character;
        const next = context.measureText(prefix).width;
        const grey = Math.round((++characters / total) * 254);
        context.fillStyle = `rgb(${grey},${grey},${grey})`;
        context.fillRect(
          left + previous,
          baseline - layout.lineHeight / 2,
          next - previous + 0.5,
          layout.lineHeight,
        );
      }
      characters++;
    }
  }
  return canvas;
}

// Time O(total raster pixels), peak memory O(one raster). IPC never holds every title at once.
/** Produce validated project-owned assets incrementally for a native export. */
export async function* projectRasters(
  project: Project,
  resolution: ExportResolution,
  signal: AbortSignal,
): AsyncGenerator<RenderRaster> {
  await loadCaptionFonts();
  const { width, height } = frameDimensions(project.ratio, resolution);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  for (const scene of project.scenes) {
    signal.throwIfAborted();
    if (scene.caption.trim()) {
      context.clearRect(0, 0, width, height);
      drawCaption(context, scene, width, height);
      yield await raster(`caption:${scene.id}`, canvas);
    }
    if (scene.backdrop.kind === "gradient") {
      renderFrame(
        context,
        { ...scene, assetId: null, caption: "", textItems: [], layers: [] },
        null,
        0,
        false,
      );
      yield await raster(`backdrop:${scene.id}`, canvas);
    }
    for (const item of scene.textItems) {
      signal.throwIfAborted();
      yield await raster(
        `text:${item.id}`,
        textCanvas(item, width, height, false),
      );
      if (item.animation === "typewriter")
        yield await raster(
          `textmask:${item.id}`,
          textCanvas(item, width, height, true),
        );
    }
    for (const layer of scene.layers)
      if (layer.kind !== "media") {
        signal.throwIfAborted();
        context.clearRect(0, 0, width, height);
        drawLayer(
          context,
          {
            ...layer,
            x: 0.5,
            y: 0.5,
            width: 0.9,
            height: 0.9,
            start: 0,
            end: null,
            endScale: 1,
            endX: null,
            endY: null,
            opacity: 1,
            endOpacity: null,
            rotation: 0,
          },
          scene.duration,
          0,
          null,
        );
        yield await raster(`layer:${layer.id}`, canvas);
      }
  }
  if (project.subtitles.length)
    for (const cue of [null, ...project.subtitles]) {
      signal.throwIfAborted();
      context.clearRect(0, 0, width, height);
      drawSubtitle(context, cue, project.subtitleStyle);
      yield await raster(`subtitle:${cue?.id ?? ""}`, canvas);
    }
}
