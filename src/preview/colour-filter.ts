import type { Adjustments } from "../../contracts/project";
import { colourMatrices } from "../domain/colour";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_CACHED_FILTERS = 64;
const cache = new Map<string, SVGFilterElement>();
let definitions: SVGDefsElement | null = null;
let nextFilter = 0;

/** Local SVG filter matrices avoid per-frame JavaScript readback of large video textures. */
export function canvasColourFilter(settings: Adjustments): string {
  const matrices = colourMatrices(settings);
  if (!matrices.length) return "none";
  const key = JSON.stringify(matrices);
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return `url(#${existing.id})`;
  }
  if (!definitions) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText =
      "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    definitions = document.createElementNS(SVG_NS, "defs");
    svg.append(definitions);
    document.body.append(svg);
  }
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = `corto-colour-${nextFilter++}`;
  filter.setAttribute("color-interpolation-filters", "sRGB");
  for (const matrix of matrices) {
    const stage = document.createElementNS(SVG_NS, "feColorMatrix");
    stage.setAttribute("type", "matrix");
    stage.setAttribute("values", matrix.join(" "));
    filter.append(stage);
  }
  definitions.append(filter);
  cache.set(key, filter);
  if (cache.size > MAX_CACHED_FILTERS) {
    const oldest = cache.keys().next().value!;
    cache.get(oldest)?.remove();
    cache.delete(oldest);
  }
  return `url(#${filter.id})`;
}
