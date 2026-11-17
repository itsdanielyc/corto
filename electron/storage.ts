import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type { ProjectRepository, SavedProject } from "../contracts/platform";
import { encodeBundleHeader, readBundleIndex } from "../contracts/bundle";
import {
  identifierSchema,
  LIMITS,
  mediaAssetSchema,
  parseProject,
  type MediaAsset,
  type Project,
} from "../contracts/project";
import { rekeyProjectAssets } from "../src/domain/rekey";
import { hasFileErrorCode, writeAtomic } from "./atomic-file";
import {
  parseSavedRecord,
  recoverRecord,
  saveRecord,
  summarizeProject,
  unavailableSummary,
} from "../src/domain/catalogue";
import type { ProjectSummary } from "../contracts/platform";
import type { ProjectAction } from "../contracts/services";
import { preferencesSchema } from "../contracts/creative";
import type { Preferences } from "../contracts/project";
import { FileVersions } from "./project-versions";

/** File-backed working copy. Opaque media IDs never become caller-controlled paths. */
export class FileProjectRepository implements ProjectRepository {
  private readonly mediaDirectory: string;
  private readonly manifestPath: string;
  private readonly initialized: Promise<void>;
  private readonly projectsDirectory: string;
  private pendingSave: Promise<void> = Promise.resolve();
  private readonly versions: FileVersions;
  private readonly deletedIds = new Set<string>();

  constructor(private readonly directory: string) {
    this.versions = new FileVersions(join(directory, "versions"));
    this.mediaDirectory = join(directory, "media");
    this.manifestPath = join(directory, "current.json");
    this.projectsDirectory = join(directory, "projects");
    this.initialized = mkdir(this.mediaDirectory, {
      recursive: true,
      mode: 0o700,
    }).then(async () => {
      await mkdir(this.projectsDirectory, { recursive: true, mode: 0o700 });
    });
  }

  /** Resolve only an opaque identifier inside this repository's private media directory. */
  assetPath(id: string): string {
    return join(this.mediaDirectory, identifierSchema.parse(id));
  }

  async assetMetadata(id: string): Promise<MediaAsset> {
    await this.initialized;
    const metadataPath = `${this.assetPath(id)}.json`;
    if ((await stat(metadataPath)).size > LIMITS.manifestBytes)
      throw new Error("Media metadata is damaged");
    const asset = mediaAssetSchema.parse(
      JSON.parse(await readFile(metadataPath, "utf8")),
    );
    if (asset.id !== id) throw new Error("Media identifiers do not match");
    return asset;
  }

  async loadProject(): Promise<Project | null> {
    await this.initialized;
    await this.pendingSave.catch(() => undefined);
    let content: string;
    try {
      if ((await stat(this.manifestPath)).size > LIMITS.manifestBytes)
        throw new Error("The saved project is too large to read safely");
      content = await readFile(this.manifestPath, "utf8");
    } catch (error) {
      if (hasFileErrorCode(error, "ENOENT")) return null;
      throw error;
    }
    try {
      return parseProject(JSON.parse(content));
    } catch {
      throw new Error(
        "The saved project is damaged. Open a portable .corto copy; your original media is still in the local workspace.",
      );
    }
  }

  async saveProject(input: Project, activate = true): Promise<void> {
    const project = parseProject(input);
    if (this.deletedIds.has(project.id))
      throw new Error("This film was removed from My films");
    const save = this.pendingSave
      .catch(() => undefined)
      .then(async () => {
        await this.initialized;
        await this.verifyMedia(project);
        const path = join(this.projectsDirectory, `${project.id}.json`);
        let previous: SavedProject | undefined;
        try {
          if ((await stat(path)).size > LIMITS.manifestBytes * 2)
            throw new Error("The saved record is too large");
          previous = parseSavedRecord(JSON.parse(await readFile(path, "utf8")));
        } catch (error) {
          if (!hasFileErrorCode(error, "ENOENT"))
            throw new Error(
              "This film's saved record is damaged. Recover it or save a portable copy before continuing.",
            );
        }
        const record = saveRecord(project, previous);
        if (
          previous &&
          JSON.stringify(previous.project) !== JSON.stringify(project)
        )
          await this.versions.archive(previous.project, previous.updatedAt);
        if (record.previous)
          await writeAtomic(
            join(this.projectsDirectory, `${project.id}.previous.json`),
            (temporary) =>
              writeFile(temporary, JSON.stringify(record.previous), {
                flag: "wx",
                mode: 0o600,
              }),
          );
        await writeAtomic(path, (temporary) =>
          writeFile(temporary, JSON.stringify(record), {
            flag: "wx",
            mode: 0o600,
          }),
        );
        if (!activate) return;
        try {
          await copyFile(
            this.manifestPath,
            join(this.directory, "previous.json"),
          );
        } catch (error) {
          if (!hasFileErrorCode(error, "ENOENT")) throw error;
        }
        await writeAtomic(this.manifestPath, (temporary) =>
          writeFile(temporary, JSON.stringify(project), {
            flag: "wx",
            mode: 0o600,
          }),
        );
      });
    this.pendingSave = save;
    return save;
  }

  async projectAction(request: ProjectAction): Promise<Project | null> {
    const id = identifierSchema.parse(request.id);
    const project = await this.openProject(id);
    if (request.operation === "delete") {
      this.deletedIds.add(id);
      await this.pendingSave.catch(() => undefined);
      const trash = join(this.directory, "trash");
      await mkdir(trash, { recursive: true, mode: 0o700 });
      await copyFile(
        join(this.projectsDirectory, `${id}.json`),
        join(trash, `${id}.json`),
      );
      await rm(join(this.projectsDirectory, `${id}.json`));
      const active = await this.loadProject();
      if (active?.id === id) await rm(this.manifestPath);
      return null;
    }
    const next = parseProject({
      ...project,
      id: request.operation === "duplicate" ? crypto.randomUUID() : id,
      name:
        request.operation === "rename"
          ? request.name
          : `${project.name.slice(0, 72)} (copy)`,
    });
    await this.saveProject(next, false);
    return next;
  }
  async listVersions(id: string) {
    await this.pendingSave.catch(() => undefined);
    return this.versions.list(identifierSchema.parse(id));
  }
  async restoreVersion(id: string, version: string) {
    const project = await this.versions.restore(
      identifierSchema.parse(id),
      identifierSchema.parse(version),
    );
    await this.saveProject(project);
    return project;
  }
  async loadPreferences(): Promise<Preferences> {
    await this.initialized;
    const path = join(this.directory, "preferences.json");
    try {
      if ((await stat(path)).size > 16384)
        throw new Error("The preferences file is damaged");
      return preferencesSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if (hasFileErrorCode(error, "ENOENT")) return preferencesSchema.parse({});
      throw error;
    }
  }
  async savePreferences(input: Preferences): Promise<void> {
    const preferences = preferencesSchema.parse(input);
    await this.initialized;
    await writeAtomic(join(this.directory, "preferences.json"), (path) =>
      writeFile(path, JSON.stringify(preferences), { flag: "wx", mode: 0o600 }),
    );
  }

  async listProjects() {
    await this.initialized;
    await this.pendingSave.catch(() => undefined);
    const summaries: ProjectSummary[] = [];
    for (const name of await readdir(this.projectsDirectory)) {
      if (!/^[A-Za-z0-9_-]+\.json$/.test(name)) continue;
      const path = join(this.projectsDirectory, name);
      const id = name.slice(0, -5);
      try {
        if ((await stat(path)).size > LIMITS.manifestBytes * 2)
          throw new Error("A saved film record is damaged");
        const record = parseSavedRecord(
          JSON.parse(await readFile(path, "utf8")),
        );
        if (record.project.id !== id)
          throw new Error("Saved film identifiers do not match");
        summaries.push(summarizeProject(record));
      } catch {
        const recovery = await this.readRecovery(id).catch(() => undefined);
        summaries.push(unavailableSummary(id, recovery));
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async openProject(id: string, recover = false): Promise<Project> {
    await this.initialized;
    await this.pendingSave.catch(() => undefined);
    const path = join(
      this.projectsDirectory,
      `${identifierSchema.parse(id)}.json`,
    );
    let project: Project;
    try {
      if ((await stat(path)).size > LIMITS.manifestBytes * 2)
        throw new Error("This saved film record is damaged");
      const record = parseSavedRecord(JSON.parse(await readFile(path, "utf8")));
      if (record.project.id !== id)
        throw new Error("Saved film identifiers do not match");
      project = recover ? recoverRecord(record) : record.project;
    } catch (error) {
      if (!recover) throw error;
      const previous = await this.readRecovery(id);
      project = recoverRecord({
        project: previous,
        previous,
        updatedAt: new Date().toISOString(),
      });
    }
    await this.verifyMedia(project);
    return project;
  }

  private async readRecovery(id: string): Promise<Project> {
    const path = join(
      this.projectsDirectory,
      `${identifierSchema.parse(id)}.previous.json`,
    );
    if ((await stat(path)).size > LIMITS.manifestBytes)
      throw new Error("The recovery snapshot is damaged");
    return parseProject(JSON.parse(await readFile(path, "utf8")));
  }

  /** Copy an immutable original in bounded chunks, failing rather than overwriting another ID. */
  async putAsset(
    input: MediaAsset,
    source: string | Uint8Array,
  ): Promise<void> {
    const asset = mediaAssetSchema.parse(input);
    await this.initialized;
    const sourceSize =
      typeof source === "string"
        ? (await stat(source)).size
        : source.byteLength;
    if (sourceSize !== asset.size)
      throw new Error(
        `The original media changed while importing ${asset.name}`,
      );
    const destination = this.assetPath(asset.id);
    const output = await open(destination, "wx", 0o600);
    try {
      if (typeof source === "string") {
        for await (const chunk of createReadStream(source))
          await output.writeFile(chunk);
      } else await output.writeFile(source);
      await output.sync();
      await output.close();
      if ((await stat(destination)).size !== asset.size)
        throw new Error(`The media copy is incomplete: ${asset.name}`);
      await writeFile(`${destination}.json`, JSON.stringify(asset), {
        flag: "wx",
        mode: 0o600,
      });
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
    await writeAtomic(destination, async (temporary) => {
      const output = await open(temporary, "wx", 0o600);
      try {
        await output.writeFile(encodeBundleHeader(project));
        for (const id of Object.keys(project.assets).sort()) {
          for await (const chunk of createReadStream(this.assetPath(id)))
            await output.writeFile(chunk);
        }
      } finally {
        await output.close();
      }
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
            const read = await input.read(
              bytes,
              offset,
              bytes.length - offset,
              start + offset,
            );
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
          for await (const chunk of createReadStream(source, {
            fd: input.fd,
            autoClose: false,
            start: offset,
            end: offset + asset.size - 1,
          }))
            await output.writeFile(chunk);
          await output.sync();
        } finally {
          await output.close();
        }
        if ((await stat(destination)).size !== asset.size)
          throw new Error(`The project is incomplete: ${asset.name}`);
        await writeFile(
          `${destination}.json`,
          JSON.stringify(remapped.project.assets[id]),
          { flag: "wx", mode: 0o600 },
        );
      }
      await this.saveProject(remapped.project);
      return remapped.project;
    } catch (error) {
      for (const id of imported) {
        await rm(this.assetPath(id), { force: true });
        await rm(`${this.assetPath(id)}.json`, { force: true });
      }
      throw error;
    } finally {
      await input.close();
    }
  }

  private async verifyMedia(project: Project): Promise<void> {
    for (const asset of Object.values(project.assets)) {
      try {
        const file = await stat(this.assetPath(asset.id));
        if (!file.isFile() || file.size !== asset.size)
          throw new Error("incomplete");
      } catch {
        throw new Error(
          `Original media is missing or incomplete: ${asset.name}`,
        );
      }
    }
  }
}
