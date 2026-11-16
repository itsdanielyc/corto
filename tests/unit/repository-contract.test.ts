import { describe, expect, it } from "vitest";
import { createProject } from "../../src/domain/project";
import { MemoryProjectRepository } from "../../src/platform/memory-repository";

describe("labelled repository contract", () => {
  it("starts empty, validates before replacing, and isolates caller mutation", async () => {
    const repository = new MemoryProjectRepository();
    expect(repository.kind).toBe("mock");
    expect(await repository.loadProject()).toBeNull();
    const project = createProject("Family film");
    await repository.saveProject(project);
    project.name = "Caller mutation";
    expect((await repository.loadProject())?.name).toBe("Family film");
    await expect(repository.saveProject({ ...project, schemaVersion: 99 } as never)).rejects.toThrow();
    expect((await repository.loadProject())?.name).toBe("Family film");
  });
});
