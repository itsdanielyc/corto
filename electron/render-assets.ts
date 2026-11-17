import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { RenderRaster } from "../contracts/services";
import {
  parseProject,
  type ExportResolution,
  type Project,
} from "../contracts/project";
import { frameDimensions } from "../src/domain/timeline";

const PREFIX = "corto-rasters-";
const MAX_RASTER_BYTES = 16 * 1024 ** 2;
const MAX_SESSION_BYTES = 2 * 1024 ** 3;
export interface StagedRaster {
  path: string;
  width: number;
  height: number;
}
interface Session {
  directory: string;
  digest: string;
  allowed: Set<string>;
  layers: Map<string, StagedRaster>;
  bytes: number;
  resolution: ExportResolution;
}
const digestProject = (project: Project) =>
  createHash("sha256").update(JSON.stringify(project)).digest("hex");

/** Validate one bounded PNG before it reaches a decoder. */
export function validateRaster(raster: RenderRaster): void {
  const { png, width, height } = raster;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    !(png instanceof Uint8Array) ||
    png.length < 24 ||
    png.length > MAX_RASTER_BYTES ||
    signature.some((byte, index) => png[index] !== byte)
  )
    throw new Error("A render layer is not a bounded PNG");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16384 ||
    height > 32768 ||
    width * height > 32 * 1024 ** 2
  )
    throw new Error("A render layer exceeds the pixel budget");
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (header.getUint32(16) !== width || header.getUint32(20) !== height)
    throw new Error("A render layer has incorrect dimensions");
}

/** Disk-backed, project-bound rasters remove the aggregate title IPC/memory ceiling. */
export class RenderAssets {
  private readonly sessions = new Map<string, Session>();
  async begin(input: Project, resolution: ExportResolution): Promise<string> {
    const project = parseProject(input);
    if (!["720p", "1080p", "2160p"].includes(resolution))
      throw new Error("Invalid raster resolution");
    if (this.sessions.size >= 2)
      throw new Error("Finish preparing the current export first");
    const allowed = new Set<string>();
    for (const scene of project.scenes) {
      if (scene.caption.trim()) allowed.add(`caption:${scene.id}`);
      if (scene.backdrop.kind === "gradient")
        allowed.add(`backdrop:${scene.id}`);
      for (const text of scene.textItems) {
        allowed.add(`text:${text.id}`);
        if (text.animation === "typewriter") allowed.add(`textmask:${text.id}`);
      }
      for (const layer of scene.layers)
        if (layer.kind !== "media") allowed.add(`layer:${layer.id}`);
    }
    if (project.subtitles.length) {
      allowed.add("subtitle:");
      for (const cue of project.subtitles) allowed.add(`subtitle:${cue.id}`);
    }
    const token = randomUUID();
    this.sessions.set(token, {
      directory: await mkdtemp(join(tmpdir(), PREFIX)),
      digest: digestProject(project),
      allowed,
      layers: new Map(),
      bytes: 0,
      resolution,
    });
    return token;
  }
  async stage(token: string, raster: RenderRaster): Promise<void> {
    const session = this.sessions.get(token);
    if (!session || !raster || !session.allowed.has(raster.key))
      throw new Error("This render layer does not belong to the export");
    validateRaster(raster);
    if (session.layers.has(raster.key))
      throw new Error("This render layer was already prepared");
    session.bytes += raster.png.length;
    if (session.bytes > MAX_SESSION_BYTES)
      throw new Error("Render layers exceed the temporary disk budget");
    const path = join(
      session.directory,
      `${createHash("sha256").update(raster.key).digest("hex")}.png`,
    );
    await writeFile(path, raster.png, { flag: "wx" });
    session.layers.set(raster.key, {
      path,
      width: raster.width,
      height: raster.height,
    });
  }
  resolve(
    token: string,
    project: Project,
    resolution: ExportResolution,
  ): ReadonlyMap<string, StagedRaster> {
    const session = this.sessions.get(token);
    if (
      !session ||
      session.digest !== digestProject(project) ||
      session.resolution !== resolution
    )
      throw new Error("The export layers do not match this immutable film");
    for (const key of session.allowed)
      if (!session.layers.has(key))
        throw new Error(`A render layer is missing: ${key.split(":")[0]}`);
    const dimensions = frameDimensions(project.ratio, resolution);
    for (const [key, layer] of session.layers)
      if (
        (key.startsWith("caption:") ||
          key.startsWith("subtitle:") ||
          key.startsWith("backdrop:")) &&
        (layer.width !== dimensions.width || layer.height !== dimensions.height)
      )
        throw new Error("A full-frame layer does not match the export");
    return session.layers;
  }
  async release(token: string): Promise<void> {
    const session = this.sessions.get(token);
    if (!session) return;
    this.sessions.delete(token);
    const directory = resolve(session.directory);
    const inside = relative(resolve(tmpdir()), directory);
    if (
      !inside.startsWith("..") &&
      !inside.includes(":") &&
      basename(directory).startsWith(PREFIX)
    )
      await rm(directory, { recursive: true, force: true });
  }
  async dispose(): Promise<void> {
    for (const token of [...this.sessions.keys()]) await this.release(token);
  }
}
