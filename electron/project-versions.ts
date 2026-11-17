import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
  identifierSchema,
  LIMITS,
  parseProject,
  type Project,
} from "../contracts/project";
import type { ProjectVersion } from "../contracts/services";
import { writeAtomic } from "./atomic-file";

const RETAINED_VERSIONS = 30;
interface VersionRecord {
  id: string;
  savedAt: string;
  project: Project;
}

/** Bounded metadata snapshots share immutable media instead of copying large originals. */
export class FileVersions {
  constructor(private readonly root: string) {}
  private directory(id: string): string {
    return join(this.root, identifierSchema.parse(id));
  }
  async archive(project: Project, savedAt: string): Promise<void> {
    const directory = this.directory(project.id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const id = randomUUID();
    const record: VersionRecord = { id, savedAt, project };
    await writeAtomic(join(directory, `${id}.json`), (path) =>
      writeFile(path, JSON.stringify(record), { flag: "wx", mode: 0o600 }),
    );
    const versions = await this.list(project.id);
    for (const version of versions.slice(RETAINED_VERSIONS))
      await rm(join(directory, `${identifierSchema.parse(version.id)}.json`));
  }
  private async read(
    projectId: string,
    versionId: string,
  ): Promise<VersionRecord> {
    const path = join(
      this.directory(projectId),
      `${identifierSchema.parse(versionId)}.json`,
    );
    if ((await stat(path)).size > LIMITS.manifestBytes + 1024)
      throw new Error("This version is too large to read");
    const value = JSON.parse(await readFile(path, "utf8")) as VersionRecord;
    if (value.id !== versionId || !Number.isFinite(Date.parse(value.savedAt)))
      throw new Error("The version metadata is damaged");
    const project = parseProject(value.project);
    if (project.id !== projectId)
      throw new Error("The version belongs to another film");
    return { ...value, project };
  }
  async list(projectId: string): Promise<ProjectVersion[]> {
    let names: string[];
    try {
      names = await readdir(this.directory(projectId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const versions: ProjectVersion[] = [];
    for (const name of names)
      if (/^[A-Za-z0-9_-]+\.json$/.test(name)) {
        const record = await this.read(projectId, name.slice(0, -5));
        versions.push({
          id: record.id,
          savedAt: record.savedAt,
          name: record.project.name,
          sceneCount: record.project.scenes.length,
        });
      }
    return versions.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
  async restore(projectId: string, versionId: string): Promise<Project> {
    const record = await this.read(projectId, versionId);
    return {
      ...record.project,
      id: randomUUID(),
      name: `${record.project.name.slice(0, 65)} (version)`,
    };
  }
}
