import { createReadStream } from "node:fs";
import { copyFile, mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectRepository } from "../contracts/platform";
import { encodeBundleHeader, readBundleIndex } from "../contracts/bundle";
import { identifierSchema, LIMITS, mediaAssetSchema, parseProject, type MediaAsset, type Project } from "../contracts/project";
import { rekeyProjectAssets } from "../src/domain/rekey";
import { hasFileErrorCode, writeAtomic } from "./atomic-file";

/** File-backed working copy. Opaque media IDs never become caller-controlled paths. */
export class FileProjectRepository implements ProjectRepository {
  private readonly mediaDirectory: string;
  private readonly manifestPath: string;
  private readonly initialized: Promise<void>;
  private pendingSave: Promise<void> = Promise.resolve();

  constructor(private readonly directory: string) {
    this.mediaDirectory = join(directory, "media");
    this.manifestPath = join(directory, "current.json");
    this.initialized = mkdir(this.mediaDirectory, { recursive: true, mode: 0o700 }).then(() => undefined);
  }

  /** Resolve only an opaque identifier inside this repository's private media directory. */
  assetPath(id: string): string { return join(this.mediaDirectory, identifierSchema.parse(id)); }

  async assetMetadata(id: string): Promise<MediaAsset> {
    await this.initialized;
    const metadataPath = `${this.assetPath(id)}.json`;
    if ((await stat(metadataPath)).size > LIMITS.manifestBytes) throw new Error("Media metadata is damaged");
    const asset = mediaAssetSchema.parse(JSON.parse(await readFile(metadataPath, "utf8")));
    if (asset.id !== id) throw new Error("Media identifiers do not match");
    return asset;
  }

  async loadProject(): Promise<Project | null> {
    await this.initialized;
    await this.pendingSave.catch(() => undefined);
    let content: string;
    try {
      if ((await stat(this.manifestPath)).size > LIMITS.manifestBytes) throw new Error("The saved project is too large to read safely");
      content = await readFile(this.manifestPath, "utf8");
    }
    catch (error) { if (hasFileErrorCode(error, "ENOENT")) return null; throw error; }
    try { return parseProject(JSON.parse(content)); }
    catch { throw new Error("The saved project is damaged. Open a portable .corto copy; your original media is still in the local workspace."); }
  }

  async saveProject(input: Project): Promise<void> {
    const project = parseProject(input);
    const save = this.pendingSave.catch(() => undefined).then(async () => {
      await this.initialized;
      await this.verifyMedia(project);
      try { await copyFile(this.manifestPath, join(this.directory, "previous.json")); }
      catch (error) { if (!hasFileErrorCode(error, "ENOENT")) throw error; }
      await writeAtomic(this.manifestPath, temporary => writeFile(temporary, JSON.stringify(project), { flag: "wx", mode: 0o600 }));
    });
    this.pendingSave = save;
    return save;
  }

  /** Copy an immutable original in bounded chunks, failing rather than overwriting another ID. */
  async putAsset(input: MediaAsset, source: string | Uint8Array): Promise<void> {
    const asset = mediaAssetSchema.parse(input);
    await this.initialized;
    const sourceSize = typeof source === "string" ? (await stat(source)).size : source.byteLength;
    if (sourceSize !== asset.size) throw new Error(`The original media changed while importing ${asset.name}`);
    const destination = this.assetPath(asset.id);
    const output = await open(destination, "wx", 0o600);
    try {
      if (typeof source === "string") {
        for await (const chunk of createReadStream(source)) await output.writeFile(chunk);
      } else await output.writeFile(source);
      await output.sync();
      await output.close();
      if ((await stat(destination)).size !== asset.size) throw new Error(`The media copy is incomplete: ${asset.name}`);
      await writeFile(`${destination}.json`, JSON.stringify(asset), { flag: "wx", mode: 0o600 });
    } catch (error) {
      await output.close().catch(() => undefined);
      await rm(destination, { force: true });
      await rm(`${destination}.json`, { force: true });
      throw error;
    }
  }

  // Time O(total media bytes), space O(manifest bytes + one stream buffer).
  /** Write a portable movie project without collecting its original media in memory. */
  async exportPortable(input: Project, destination: string): Promise<void> {
    const project = parseProject(input);
    await this.initialized;
    await this.verifyMedia(project);
    await writeAtomic(destination, async temporary => {
      const output = await open(temporary, "wx", 0o600);
      try {
        await output.writeFile(encodeBundleHeader(project));
        for (const id of Object.keys(project.assets).sort()) {
          for await (const chunk of createReadStream(this.assetPath(id))) await output.writeFile(chunk);
        }
      } finally { await output.close(); }
    });
  }

  // Time O(total media bytes), space O(manifest bytes + one stream buffer).
  /** Validate first, stage originals under fresh IDs, then atomically replace the working copy. */
  async importPortable(source: string): Promise<Project> {
    const input = await open(source, "r");
    const imported: string[] = [];
    try {
      const fileStat = await input.stat();
      const index = await readBundleIndex({
        size: fileStat.size,
        read: async (start, end) => {
          const bytes = new Uint8Array(end - start);
          let offset = 0;
          while (offset < bytes.length) {
            const read = await input.read(bytes, offset, bytes.length - offset, start + offset);
            if (!read.bytesRead) break;
            offset += read.bytesRead;
          }
          return bytes.subarray(0, offset);
        },
      });
      const remapped = rekeyProjectAssets(index.project);
      await this.initialized;
      for (const { asset, offset } of index.assets) {
        const id = remapped.identifiers.get(asset.id)!;
        const destination = this.assetPath(id);
        const output = await open(destination, "wx", 0o600);
        imported.push(id);
        try {
          for await (const chunk of createReadStream(source, { fd: input.fd, autoClose: false, start: offset, end: offset + asset.size - 1 })) await output.writeFile(chunk);
          await output.sync();
        } finally { await output.close(); }
        if ((await stat(destination)).size !== asset.size) throw new Error(`The project is incomplete: ${asset.name}`);
        await writeFile(`${destination}.json`, JSON.stringify(remapped.project.assets[id]), { flag: "wx", mode: 0o600 });
      }
      await this.saveProject(remapped.project);
      return remapped.project;
    } catch (error) {
      for (const id of imported) {
        await rm(this.assetPath(id), { force: true });
        await rm(`${this.assetPath(id)}.json`, { force: true });
      }
      throw error;
    } finally { await input.close(); }
  }

  private async verifyMedia(project: Project): Promise<void> {
    for (const asset of Object.values(project.assets)) {
      try {
        const file = await stat(this.assetPath(asset.id));
        if (!file.isFile() || file.size !== asset.size) throw new Error("incomplete");
      } catch { throw new Error(`Original media is missing or incomplete: ${asset.name}`); }
    }
  }
}
