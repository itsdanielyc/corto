import type { ProjectSummary, SavedProject } from "../../contracts/platform";
import { parseProject, type Project } from "../../contracts/project";

/** Keep the last distinct edit rather than replacing recovery with identical autosaves. */
export function saveRecord(
  project: Project,
  previous?: SavedProject,
): SavedProject {
  const parsed = parseProject(project);
  const changed =
    previous && JSON.stringify(previous.project) !== JSON.stringify(parsed);
  return {
    project: parsed,
    updatedAt: new Date().toISOString(),
    previous: changed ? previous.project : (previous?.previous ?? null),
  };
}

/** Project metadata is safe to show before loading or decoding its media. */
export function summarizeProject(record: SavedProject): ProjectSummary {
  const { project } = record;
  const first = project.scenes.find((scene) => scene.assetId);
  return {
    id: project.id,
    name: project.name,
    updatedAt: record.updatedAt,
    sceneCount: project.scenes.length,
    duration: project.scenes.reduce((sum, scene) => sum + scene.duration, 0),
    thumbnail: first?.assetId ? project.assets[first.assetId] : null,
    hasRecovery: record.previous !== null,
  };
}

/** Restore into a fresh identity so the latest saved film remains available. */
export function recoverRecord(record: SavedProject): Project {
  if (!record.previous)
    throw new Error("No recovery snapshot is available for this film");
  return {
    ...parseProject(record.previous),
    id: crypto.randomUUID(),
    name: `${record.previous.name.slice(0, 63)} (recovered)`,
  };
}

/** Validate persisted catalogue records separately from their small list-view summaries. */
export function parseSavedRecord(input: unknown): SavedProject {
  if (
    !input ||
    typeof input !== "object" ||
    !("project" in input) ||
    !("updatedAt" in input) ||
    typeof input.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(input.updatedAt)) ||
    !("previous" in input)
  )
    throw new Error("This saved film record is damaged");
  return {
    project: parseProject(input.project),
    updatedAt: input.updatedAt,
    previous: input.previous === null ? null : parseProject(input.previous),
  };
}

/** Retain unreadable entries visibly without preventing access to healthy films. */
export function unavailableSummary(
  id: string,
  recovery?: Project,
): ProjectSummary {
  return {
    id,
    name: recovery?.name ?? "Unreadable saved film",
    updatedAt: new Date(0).toISOString(),
    sceneCount: recovery?.scenes.length ?? 0,
    duration: 0,
    thumbnail: null,
    hasRecovery: !!recovery,
    unavailableReason: recovery
      ? "The latest saved record is damaged. Recover the previous edit as a separate copy."
      : "This saved record could not be read. Open a portable backup to restore your film.",
  };
}
