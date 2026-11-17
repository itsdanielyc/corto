import type { Adjustments } from "../../contracts/project";

export type ColourMatrix = readonly number[];
const LUMA = [0.2126, 0.7152, 0.0722] as const;
const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** Ordered sRGB matrices are shared by canvas/SVG and native pixel filters. */
export function colourMatrices(settings: Adjustments): ColourMatrix[] {
  let brightness = settings.brightness;
  let contrast = settings.contrast;
  let saturation = settings.saturation;
  let warmth = settings.warmth;
  if (settings.look === "mono") saturation = -1;
  if (settings.look === "warm") warmth = Math.min(1, warmth + 0.3);
  if (settings.look === "cool") warmth = Math.max(-1, warmth - 0.3);
  if (settings.look === "vivid") {
    saturation = Math.min(1, saturation + 0.3);
    contrast = Math.min(1, contrast + 0.12);
  }
  if (settings.look === "faded") {
    brightness = Math.min(1, brightness + 0.08);
    contrast = Math.max(-0.9, contrast - 0.18);
  }
  const matrices: ColourMatrix[] = [];
  if (brightness || contrast) {
    const gain = 1 + contrast;
    const offset = (1 - gain) / 2 + brightness / 2;
    matrices.push([
      gain,
      0,
      0,
      0,
      offset,
      0,
      gain,
      0,
      0,
      offset,
      0,
      0,
      gain,
      0,
      offset,
      0,
      0,
      0,
      1,
      0,
    ]);
  }
  if (saturation) {
    const amount = 1 + saturation;
    const rows = LUMA.map((_, row) =>
      LUMA.map(
        (luma, column) => luma * (1 - amount) + (row === column ? amount : 0),
      ),
    );
    matrices.push([
      ...rows[0],
      0,
      0,
      ...rows[1],
      0,
      0,
      ...rows[2],
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]);
  }
  if (warmth) {
    const matrix = [...IDENTITY];
    matrix[0] = 1 + warmth * 0.25;
    matrix[12] = 1 - warmth * 0.25;
    matrices.push(matrix);
  }
  if (settings.look === "sepia")
    matrices.push([
      0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131,
      0, 0, 0, 0, 0, 1, 0,
    ]);
  return matrices;
}

/** Reference pixel math provides independent tests for both rendering adapters. */
export function transformColour(
  red: number,
  green: number,
  blue: number,
  matrices: readonly ColourMatrix[],
): [number, number, number] {
  let rgb = [red / 255, green / 255, blue / 255];
  for (const matrix of matrices)
    rgb = [0, 1, 2].map((row) =>
      Math.max(
        0,
        Math.min(
          1,
          matrix[row * 5] * rgb[0] +
            matrix[row * 5 + 1] * rgb[1] +
            matrix[row * 5 + 2] * rgb[2] +
            matrix[row * 5 + 4],
        ),
      ),
    );
  return rgb.map((value) => Math.round(value * 255)) as [
    number,
    number,
    number,
  ];
}

/** Analyse a small decoded sample, keeping enhancement independent of original image size. */
export function autoAdjustments(
  pixels: Uint8ClampedArray,
): Pick<Adjustments, "brightness" | "contrast" | "saturation"> {
  let sum = 0;
  let squared = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    const light =
      (pixels[index] * LUMA[0] +
        pixels[index + 1] * LUMA[1] +
        pixels[index + 2] * LUMA[2]) /
      255;
    sum += light;
    squared += light * light;
    count++;
  }
  if (!count) return { brightness: 0, contrast: 0, saturation: 0 };
  const mean = sum / count;
  const deviation = Math.sqrt(Math.max(0, squared / count - mean * mean));
  return {
    brightness: Math.max(-0.25, Math.min(0.35, (0.5 - mean) * 0.8)),
    contrast: Math.max(-0.15, Math.min(0.4, (0.22 - deviation) * 1.5)),
    saturation: 0.08,
  };
}
