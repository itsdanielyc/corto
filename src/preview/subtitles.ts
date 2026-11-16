import type { MovieRequest } from "../../contracts/platform";
import type { Project, Subtitle } from "../../contracts/project";
import { frameDimensions } from "../domain/timeline";
import { loadCaptionFonts, wrapCaption } from "./captions";

/** Paint readable subtitles independently of scene titles, with the same renderer for every output. */
export function drawSubtitle(
  context: CanvasRenderingContext2D,
  cue: Subtitle | null,
): void {
  if (!cue) return;
  const { width, height } = context.canvas;
  const fontSize = Math.min(height * 0.048, width * 0.055);
  const lineHeight = fontSize * 1.3;
  context.save();
  context.font = `700 ${fontSize}px "Manrope Variable", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lines = wrapCaption(
    cue.text,
    width * 0.84,
    (text) => context.measureText(text).width,
  );
  const top = height * 0.92 - lineHeight * lines.length;
  const padding = fontSize * 0.35;
  for (const [index, line] of lines.entries()) {
    const y = top + index * lineHeight;
    const textWidth = context.measureText(line).width;
    context.fillStyle = "rgba(0,0,0,0.8)";
    context.fillRect(
      (width - textWidth) / 2 - padding,
      y - lineHeight / 2,
      textWidth + padding * 2,
      lineHeight,
    );
    context.fillStyle = "#ffffff";
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
    drawSubtitle(context, cue);
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
