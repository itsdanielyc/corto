import { LIMITS, parseProject, type MediaAsset, type Project } from "./project";

const SIGNATURE = "CORTO001";
const PREFIX_BYTES = 12;

export interface RangeReader { size: number; read(start: number, end: number): Promise<Uint8Array> }
export interface BundleIndex { project: Project; assets: { asset: MediaAsset; offset: number }[] }

/** Generate a small manifest header; original compressed media follows without recompression. */
export function encodeBundleHeader(input: Project): Uint8Array<ArrayBuffer> {
  const project = parseProject(input);
  const manifest = new TextEncoder().encode(JSON.stringify(project));
  if (manifest.length > LIMITS.manifestBytes) throw new Error("The project manifest is too large");
  const header = new Uint8Array(PREFIX_BYTES + manifest.length);
  header.set(new TextEncoder().encode(SIGNATURE));
  new DataView(header.buffer).setUint32(SIGNATURE.length, manifest.length, true);
  header.set(manifest, PREFIX_BYTES);
  return header;
}

// Time O(manifest bytes + a log a), space O(manifest bytes + a), independent of media byte size.
/** Validate and index a portable project before any original media is imported. */
export async function readBundleIndex(reader: RangeReader): Promise<BundleIndex> {
  const prefix = await reader.read(0, PREFIX_BYTES);
  if (prefix.length !== PREFIX_BYTES || new TextDecoder().decode(prefix.subarray(0, SIGNATURE.length)) !== SIGNATURE) throw new Error("This is not a supported Corto project file");
  const length = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength).getUint32(SIGNATURE.length, true);
  if (!length || length > LIMITS.manifestBytes || PREFIX_BYTES + length > reader.size) throw new Error("The project manifest is incomplete or too large");
  const manifest = await reader.read(PREFIX_BYTES, PREFIX_BYTES + length);
  if (manifest.length !== length) throw new Error("The project manifest is incomplete");
  let project: Project;
  try {
    project = parseProject(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifest)));
  } catch (error) {
    throw new Error(`The project manifest is invalid: ${error instanceof Error ? error.message : "unknown format"}`);
  }
  let offset = PREFIX_BYTES + length;
  const assets = Object.keys(project.assets).sort().map(id => {
    const asset = project.assets[id];
    const entry = { asset, offset };
    offset += asset.size;
    return entry;
  });
  if (offset > reader.size) throw new Error("The project is incomplete: original media is missing");
  if (offset !== reader.size) throw new Error("The project file length does not match its manifest");
  return { project, assets };
}
