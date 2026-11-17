import type { Scene, MediaAsset } from "../../contracts/project";
import { cameraEndpoints } from "../domain/composition";
import { colourMatrices } from "../domain/colour";

const rounded = (value: number) => Number(value.toFixed(7));

/** Numeric sRGB filters mirror the ordered canvas colour matrices. */
export function colourFilters(scene: Scene): string[] {
  return colourMatrices(scene.adjustments).map((matrix) => {
    const offset = matrix[4];
    if (
      offset ||
      (matrix[0] > 1 &&
        matrix[1] === 0 &&
        matrix[2] === 0 &&
        matrix[6] === matrix[0])
    ) {
      return `lutrgb=r='clip(val*${matrix[0]}+${offset * 255},0,255)':g='clip(val*${matrix[6]}+${matrix[9] * 255},0,255)':b='clip(val*${matrix[12]}+${matrix[14] * 255},0,255)'`;
    }
    const names = ["rr", "rg", "rb", "gr", "gg", "gb", "br", "bg", "bb"];
    const indices = [0, 1, 2, 5, 6, 7, 10, 11, 12];
    return `colorchannelmixer=${names.map((name, index) => `${name}=${rounded(matrix[indices[index]])}`).join(":")}`;
  });
}

/** Post-orientation flips match the canvas contract, including quarter turns. */
export function orientationFilters(scene: Scene): string[] {
  const filters: string[] = [];
  if (scene.transform.rotation === 90) filters.push("transpose=clock");
  if (scene.transform.rotation === 180) filters.push("hflip", "vflip");
  if (scene.transform.rotation === 270) filters.push("transpose=cclock");
  if (scene.transform.flipX) filters.push("hflip");
  if (scene.transform.flipY) filters.push("vflip");
  return filters;
}

/** Affine destination corners keep crop, contain and motion identical without allocating a zoomed 4K image. */
export function cameraFilter(
  scene: Scene,
  asset: MediaAsset,
  width: number,
  height: number,
  fps: number,
  localStart: number,
): string {
  const quarterTurn =
    scene.transform.rotation === 90 || scene.transform.rotation === 270;
  const sourceWidth = quarterTurn ? asset.height : asset.width;
  const sourceHeight = quarterTurn ? asset.width : asset.height;
  const cap = Math.min(1, 4096 / Math.max(sourceWidth, sourceHeight));
  const sw = Math.max(2, Math.round(sourceWidth * cap));
  const sh = Math.max(2, Math.round(sourceHeight * cap));
  const workWidth = Math.max(
    2,
    Math.floor(Math.min(sw, (sh * width) / height)),
  );
  const workHeight = Math.max(2, Math.floor((workWidth * height) / width));
  const fit = (scene.fit === "cover" ? Math.max : Math.min)(
    workWidth / sw,
    workHeight / sh,
  );
  const { from, to } = cameraEndpoints(scene);
  const progress = `clip((on/${fps}+${localStart})/${scene.duration},0,1)`;
  const interpolate = (start: number, end: number) =>
    start === end
      ? String(rounded(start))
      : `(${rounded(start)}+${rounded(end - start)}*${progress})`;
  const zoom = interpolate(from.zoom, to.zoom);
  const fx = interpolate(from.focusX, to.focusX);
  const fy = interpolate(from.focusY, to.focusY);
  const scale = `(${rounded(fit)}*${zoom})`;
  const x0 = `((${workWidth}-${sw}*${scale})*${fx}-${scale})`;
  const y0 = `((${workHeight}-${sh}*${scale})*${fy}-${scale})`;
  const x1 = `(${x0}+${sw + 2}*${scale})`;
  const y1 = `(${y0}+${sh + 2}*${scale})`;
  return `scale=${sw}:${sh},format=gbrap,pad=iw+2:ih+2:1:1:color=black@0,perspective=sense=destination:eval=frame:x0='${x0}':y0='${y0}':x1='${x1}':y1='${y0}':x2='${x0}':y2='${y1}':x3='${x1}':y3='${y1}',crop=${workWidth}:${workHeight}:0:0,scale=${width}:${height},setsar=1`;
}

/** atempo's supported range requires a short chain for very slow/fast clips. */
export function tempoFilters(speed: number, preservePitch: boolean): string[] {
  if (speed === 1) return [];
  if (!preservePitch) return [`asetrate=48000*${speed}`, "aresample=48000"];
  const filters: string[] = [];
  let remainder = speed;
  while (remainder > 2) {
    filters.push("atempo=2");
    remainder /= 2;
  }
  while (remainder < 0.5) {
    filters.push("atempo=0.5");
    remainder *= 2;
  }
  filters.push(`atempo=${remainder}`);
  return filters;
}
