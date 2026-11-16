import type { ProjectRepository, SavedProject } from "../../contracts/platform";
import {
  identifierSchema,
  parseProject,
  type Project,
} from "../../contracts/project";
import {
  recoverRecord,
  saveRecord,
  summarizeProject,
} from "../domain/catalogue";

/** Labelled test repository with the same validation and copy boundaries as persisted projects. */
export class MemoryProjectRepository implements ProjectRepository {
  readonly kind = "mock" as const;
  private project: Project | null = null;
  private readonly records = new Map<string, SavedProject>();

  async loadProject(): Promise<Project | null> {
    return this.project ? parseProject(this.project) : null;
  }

  async saveProject(project: Project): Promise<void> {
    this.project = parseProject(project);
    this.records.set(
      project.id,
      saveRecord(project, this.records.get(project.id)),
    );
  }
  async listProjects() {
    return [...this.records.values()]
      .map(summarizeProject)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async openProject(id: string, recover = false): Promise<Project> {
    const record = this.records.get(identifierSchema.parse(id));
    if (!record) throw new Error("This saved film could not be found");
    return recover ? recoverRecord(record) : parseProject(record.project);
  }
}
