import type { TextItem } from "../../contracts/project";

export const FONT_FAMILIES = {
  serif: '"DM Serif Display", Georgia, serif',
  sans: '"Manrope Variable", sans-serif',
  mono: '"JetBrains Mono Variable", monospace',
  rounded: '"Nunito Variable", sans-serif',
} as const;
export interface TextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
}

// Time O(characters²) for a single unbroken word, space O(characters). Input is bounded to 8,000 characters.
/** Wrap every Unicode code point, preserving paragraphs and never silently truncating a title. */
export function wrapText(
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
  return lines;
}

export function textFont(item: TextItem, size: number): string {
  return `${item.italic ? "italic " : ""}${item.bold ? 700 : 400} ${size}px ${FONT_FAMILIES[item.font]}`;
}

/** Long static text automatically fits the safe area; credits retain their chosen readable size. */
export function layoutText(
  context: CanvasRenderingContext2D,
  item: TextItem,
  width: number,
  height: number,
): TextLayout {
  let size = Math.min(width, height) * item.size;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    context.font = textFont(item, size);
    lines = wrapText(
      item.text,
      width * item.width,
      (text) => context.measureText(text).width,
    );
    const needed = lines.length * size * 1.25;
    if (item.animation === "credits" || needed <= height * 0.88) break;
    size *= Math.min(0.9, Math.sqrt((height * 0.88) / needed));
  }
  return {
    lines,
    fontSize: size,
    lineHeight: size * 1.25,
    width: width * item.width,
    height: lines.length * size * 1.25,
  };
}

/** Paint timed, styled text using the same geometry as export raster preparation. */
export function drawText(
  context: CanvasRenderingContext2D,
  item: TextItem,
  duration: number,
  time: number,
): void {
  const end = item.end ?? duration;
  if (time < item.start || time >= end || !item.text) return;
  const { width, height } = context.canvas;
  context.save();
  const layout = layoutText(context, item, width, height);
  const elapsed = time - item.start;
  const span = end - item.start;
  const incoming = Math.min(1, elapsed / item.animationSeconds);
  const outgoing = Math.min(1, (end - time) / item.animationSeconds);
  let x = width * item.x;
  let y = height * item.y;
  if (item.animation === "fade")
    context.globalAlpha *= Math.min(incoming, outgoing);
  if (item.animation === "slide") {
    y += (1 - incoming) * height * 0.12;
    context.globalAlpha *= Math.min(incoming, outgoing);
  }
  if (item.animation === "pop") {
    context.translate(x, y);
    const scale = 0.7 + incoming * 0.3;
    context.scale(scale, scale);
    x = y = 0;
    context.globalAlpha *= incoming;
  }
  if (item.animation === "credits")
    y =
      height + layout.height / 2 - ((height + layout.height) * elapsed) / span;
  context.font = textFont(item, layout.fontSize);
  context.textAlign = item.align;
  context.textBaseline = "middle";
  const top = y - layout.height / 2;
  const left = x - layout.width / 2;
  const anchor =
    item.align === "left"
      ? left
      : item.align === "right"
        ? left + layout.width
        : x;
  if (item.boxOpacity) {
    context.save();
    context.globalAlpha *= item.boxOpacity;
    context.fillStyle = item.boxColour;
    context.fillRect(
      left - layout.fontSize * 0.3,
      top - layout.fontSize * 0.2,
      layout.width + layout.fontSize * 0.6,
      layout.height + layout.fontSize * 0.4,
    );
    context.restore();
  }
  if (item.shadow) {
    context.shadowColor = "#00000099";
    context.shadowBlur = layout.fontSize * 0.2;
    context.shadowOffsetY = layout.fontSize * 0.05;
  }
  context.fillStyle = item.colour;
  context.strokeStyle = item.outline;
  context.lineWidth = height * item.outlineWidth * 2;
  context.lineJoin = "round";
  let remaining =
    item.animation === "typewriter"
      ? Math.floor([...item.text].length * incoming)
      : Infinity;
  layout.lines.forEach((line, index) => {
    const characters = [...line];
    const visible = characters.slice(0, remaining).join("");
    remaining = Math.max(0, remaining - characters.length - 1);
    const baseline = top + (index + 0.5) * layout.lineHeight;
    if (item.outlineWidth) context.strokeText(visible, anchor, baseline);
    context.fillText(visible, anchor, baseline);
  });
  context.restore();
}
