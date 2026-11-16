import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { FileProjectRepository } from "../../electron/storage";
import {
  addAsset,
  appendScene,
  createProject,
  createScene,
} from "../../src/domain/project";
import { MemoryProjectRepository } from "../../src/platform/memory-repository";
import type { ProjectRepository } from "../../contracts/platform";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "corto-storage-"));
});
afterEach(async () => {
  if (basename(directory).startsWith("corto-storage-"))
    await rm(directory, { recursive: true, force: true });
});

describe.each(["memory", "native"] as const)(
  "%s persistence conformance",
  (kind) => {
    it("keeps multiple named films and restores the previous edit into a separate film", async () => {
      const repository: ProjectRepository =
        kind === "native"
          ? new FileProjectRepository(directory)
          : new MemoryProjectRepository();
      const first = createProject("First holiday");
      await repository.saveProject(first);
      await repository.saveProject({ ...first, name: "Final holiday" });
      const second = createProject("Birthday");
      await repository.saveProject(second);
      expect(
        (await repository.listProjects()).map((entry) => entry.name).sort(),
      ).toEqual(["Birthday", "Final holiday"]);
      const reopened = await repository.openProject(first.id);
      expect(reopened.name).toBe("Final holiday");
      const recovered = await repository.openProject(first.id, true);
      expect(recovered.id).not.toBe(first.id);
      expect(recovered.name).toContain("First holiday");
      await repository.saveProject(recovered);
      expect(await repository.listProjects()).toHaveLength(3);
      expect((await repository.openProject(first.id)).name).toBe(
        "Final holiday",
      );
      await expect(repository.openProject("../outside")).rejects.toThrow();
    });
    it("starts empty, round-trips, rejects malformed writes and survives caller mutations", async () => {
      const repository: ProjectRepository =
        kind === "native"
          ? new FileProjectRepository(directory)
          : new MemoryProjectRepository();
      expect(await repository.loadProject()).toBeNull();
      const project = createProject("Family film");
      await repository.saveProject(project);
      project.name = "Uncommitted change";
      expect((await repository.loadProject())?.name).toBe("Family film");
      await expect(
        repository.saveProject({ ...project, schemaVersion: 999 } as never),
      ).rejects.toThrow();
      expect((await repository.loadProject())?.name).toBe("Family film");
    });
  },
);

describe("native original media and portable files", () => {
  it("keeps healthy films accessible and recovers a damaged catalogue entry from its independent snapshot", async () => {
    const repository = new FileProjectRepository(directory);
    const first = createProject("Recover this");
    await repository.saveProject(first);
    await repository.saveProject({ ...first, name: "Latest edit" });
    await repository.saveProject(createProject("Healthy film"));
    await writeFile(
      join(directory, "projects", `${first.id}.json`),
      "{damaged",
    );
    const summaries = await repository.listProjects();
    expect(summaries.some((entry) => entry.name === "Healthy film")).toBe(true);
    expect(summaries.find((entry) => entry.id === first.id)?.hasRecovery).toBe(
      true,
    );
    expect((await repository.openProject(first.id, true)).name).toBe(
      "Recover this (recovered)",
    );
  });
  it("streams a self-contained copy and reopens after the source workspace is gone", async () => {
    const repository = new FileProjectRepository(join(directory, "source"));
    const bytes = new Uint8Array(256 * 1024).fill(73);
    const asset = {
      id: "family-photo",
      name: "Été.jpg",
      kind: "image" as const,
      mime: "image/jpeg",
      size: bytes.length,
      duration: 0,
      width: 10,
      height: 10,
    };
    const source = join(directory, "original.jpg");
    await writeFile(source, bytes);
    await repository.putAsset(asset, source);
    const project = appendScene(
      addAsset(createProject("Our summer"), asset),
      createScene(asset),
    );
    await repository.saveProject(project);
    const portable = join(directory, "Our summer.corto");
    await repository.exportPortable(project, portable);
    await rm(source);
    const destination = new FileProjectRepository(
      join(directory, "destination"),
    );
    const reopened = await destination.importPortable(portable);
    expect(reopened.name).toBe("Our summer");
    const restoredAsset = Object.values(reopened.assets)[0];
    expect(restoredAsset.id).not.toBe(asset.id);
    expect(reopened.scenes[0].assetId).toBe(restoredAsset.id);
    expect(
      new Uint8Array(await readFile(destination.assetPath(restoredAsset.id))),
    ).toEqual(bytes);
    expect(
      (
        await new FileProjectRepository(
          join(directory, "destination"),
        ).loadProject()
      )?.name,
    ).toBe("Our summer");
  });

  it("preserves the previous project after corrupt imports and missing media writes", async () => {
    const repository = new FileProjectRepository(directory);
    await repository.saveProject(createProject("Keep me"));
    const corrupt = join(directory, "broken.corto");
    await writeFile(corrupt, "not a project");
    await expect(repository.importPortable(corrupt)).rejects.toThrow(/Corto/i);
    const missing = {
      id: "missing",
      name: "missing.jpg",
      kind: "image" as const,
      mime: "image/jpeg",
      size: 4,
      duration: 0,
      width: 1,
      height: 1,
    };
    await expect(
      repository.saveProject(addAsset(createProject("Bad save"), missing)),
    ).rejects.toThrow(/media/i);
    expect((await repository.loadProject())?.name).toBe("Keep me");
    expect(() => repository.assetPath("../outside")).toThrow();
  });

  it("serializes concurrent autosaves and exposes corrupt manifests instead of replacing them", async () => {
    const repository = new FileProjectRepository(directory);
    await Promise.all([
      repository.saveProject(createProject("First")),
      repository.saveProject(createProject("Latest")),
    ]);
    expect((await repository.loadProject())?.name).toBe("Latest");
    await writeFile(join(directory, "current.json"), "{broken");
    await expect(repository.loadProject()).rejects.toThrow(/saved project/i);
  });
});
