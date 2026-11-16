import type { ProjectRepository } from "../../contracts/platform";
import { parseProject, type Project } from "../../contracts/project";

/** Labelled test repository with the same validation and copy boundaries as persisted projects. */
export class MemoryProjectRepository implements ProjectRepository {
  readonly kind = "mock" as const;
  private project: Project | null = null;

  async loadProject(): Promise<Project | null> {
    return this.project ? parseProject(this.project) : null;
  }

  async saveProject(project: Project): Promise<void> {
    this.project = parseProject(project);
  }
}
