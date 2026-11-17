import type { CaptionOverlay } from "../../contracts/platform";
import type { ExportResolution, Project, Scene } from "../../contracts/project";
import { frameDimensions } from "../domain/timeline";
import { wrapText } from "./text";

const MAX_CAPTION_LINES = 4;
let fontsReady: Promise<unknown> | null = null;

/** Explicitly load the bundled faces before a canvas or export rasterizes its first title. */
export function loadCaptionFonts(): Promise<unknown> {
  fontsReady ??= Promise.all([
    document.fonts.load('400 60px "DM Serif Display"'),
    document.fonts.load('700 60px "Manrope Variable"'),
  ]);
  return fontsReady;
}

// Time O(n²) in the worst case of a single unbroken word, space O(n); captions are capped at 160 characters.
/** Preserve deliberate line breaks and wrap long words without cutting a Unicode code point. */
export function wrapCaption(
  text: string,
  maximumWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maximumWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const character of word) {
        if (line && measure(line + character) > maximumWidth) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  if (lines.length <= MAX_CAPTION_LINES) return lines;
  const visible = lines.slice(0, MAX_CAPTION_LINES);
  let last = visible[MAX_CAPTION_LINES - 1];
  while (last && measure(`${last}…`) > maximumWidth)
    last = [...last].slice(0, -1).join("");
  visible[MAX_CAPTION_LINES - 1] = `${last}…`;
  return visible;
}

function darkBackground(colour: string): boolean {
  const value = Number.parseInt(colour.slice(1), 16);
  return (
    ((value >> 16) & 255) * 0.299 +
      ((value >> 8) & 255) * 0.587 +
      (value & 255) * 0.114 <
    150
  );
}

/** Draw the same caption layer for preview, web recording and native FFmpeg overlays. */
export function drawCaption(
  context: CanvasRenderingContext2D,
  scene: Scene,
  width: number,
  height: number,
): void {
  if (!scene.caption.trim()) return;
  context.save();
  const classic = scene.captionStyle === "classic";
  const minimal = scene.captionStyle === "minimal";
  let fontSize = Math.min(
    height * (minimal ? 0.052 : 0.112),
    width * (minimal ? 0.055 : 0.112),
  );
  const text = minimal ? scene.caption.toLocaleUpperCase() : scene.caption;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    context.font = classic
      ? `400 ${fontSize}px "DM Serif Display", Georgia, serif`
      : `${minimal ? 500 : 700} ${fontSize}px "Manrope Variable", sans-serif`;
    lines = wrapText(
      text,
      width * 0.82,
      (value) => context.measureText(value).width,
    );
    if (lines.length * fontSize * 1.17 <= height * 0.8) break;
    fontSize *= Math.min(
      0.9,
      Math.sqrt((height * 0.8) / (lines.length * fontSize * 1.17)),
    );
  }
  const lineHeight = fontSize * 1.17;
  const middle =
    scene.captionPosition === "bottom"
      ? height * 0.84 - ((lines.length - 1) * lineHeight) / 2
      : height / 2;
  if (scene.assetId && scene.captionShade) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0,0,0,0.08)");
    gradient.addColorStop(1, "rgba(0,0,0,0.48)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.shadowColor = "rgba(0,0,0,0.3)";
    context.shadowBlur = height * 0.02;
    context.shadowOffsetY = height * 0.004;
  }
  context.fillStyle =
    scene.assetId || darkBackground(scene.background) ? "#ffffff" : "#151517";
  context.textAlign = "center";
  context.textBaseline = "middle";
  lines.forEach((line, index) =>
    context.fillText(
      line,
      width / 2,
      middle + (index - (lines.length - 1) / 2) * lineHeight,
    ),
  );
  context.restore();
}

/** Native export receives transparent PNG layers, preserving local font rendering exactly. */
export async function createCaptionOverlays(
  project: Project,
  resolution: ExportResolution,
  signal: AbortSignal,
): Promise<CaptionOverlay[]> {
  await loadCaptionFonts();
  const { width, height } = frameDimensions(project.ratio, resolution);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This device cannot render title overlays");
  const overlays: CaptionOverlay[] = [];
  for (const scene of project.scenes) {
    signal.throwIfAborted();
    if (!scene.caption.trim()) continue;
    context.clearRect(0, 0, width, height);
    drawCaption(context, scene, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not render a title")),
        "image/png",
      ),
    );
    overlays.push({
      sceneId: scene.id,
      png: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  return overlays;
}
