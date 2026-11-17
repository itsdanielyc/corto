import type { MovieRequest } from "../../contracts/platform";
import type { Project, Subtitle, SubtitleStyle } from "../../contracts/project";
import { subtitleStyleSchema } from "../../contracts/creative";
import { FONT_FAMILIES } from "./text";
import { frameDimensions } from "../domain/timeline";
import { loadCaptionFonts, wrapCaption } from "./captions";

/** Paint readable subtitles independently of scene titles, with the same renderer for every output. */
export function drawSubtitle(
  context: CanvasRenderingContext2D,
  cue: Subtitle | null,
  style: SubtitleStyle = subtitleStyleSchema.parse({}),
): void {
  if (!cue) return;
  const { width, height } = context.canvas;
  const fontSize = Math.min(height * style.size, width * style.size * 1.15);
  const lineHeight = fontSize * 1.3;
  context.save();
  context.font = `700 ${fontSize}px ${FONT_FAMILIES[style.font]}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lines = wrapCaption(
    cue.text,
    width * 0.84,
    (text) => context.measureText(text).width,
  );
  const top =
    style.position === "top"
      ? height * 0.1
      : style.position === "middle"
        ? (height - lineHeight * lines.length) / 2
        : height * 0.92 - lineHeight * lines.length;
  const padding = fontSize * 0.35;
  for (const [index, line] of lines.entries()) {
    const y = top + index * lineHeight;
    const textWidth = context.measureText(line).width;
    context.save();
    context.globalAlpha *= style.boxOpacity;
    context.fillStyle = style.boxColour;
    context.fillRect(
      (width - textWidth) / 2 - padding,
      y - lineHeight / 2,
      textWidth + padding * 2,
      lineHeight,
    );
    context.restore();
    context.fillStyle = style.colour;
    context.fillText(line, width / 2, y);
  }
  context.restore();
}

/** Include a transparent gap frame so native exports can show and clear each timed cue. */
export async function createSubtitleOverlays(
  project: Project,
  resolution: MovieRequest["resolution"],
  signal: AbortSignal,
): Promise<NonNullable<MovieRequest["subtitleOverlays"]>> {
  if (!project.subtitles.length) return [];
  await loadCaptionFonts();
  const { width, height } = frameDimensions(project.ratio, resolution);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This device cannot render subtitles");
  const overlays: NonNullable<MovieRequest["subtitleOverlays"]> = [];
  for (const cue of [null, ...project.subtitles]) {
    signal.throwIfAborted();
    context.clearRect(0, 0, width, height);
    drawSubtitle(context, cue, project.subtitleStyle);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("A subtitle could not be rendered")),
        "image/png",
      ),
    );
    overlays.push({
      cueId: cue?.id ?? "",
      png: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  return overlays;
}
