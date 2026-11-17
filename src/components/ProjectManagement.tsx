import { useState } from "react";
import type { ProjectSummary } from "../../contracts/platform";
import type { Project } from "../../contracts/project";
import type { ProjectVersion } from "../../contracts/services";
import type { CortoPlatform } from "../platform/types";

/** Manage catalogue metadata and restore history into separate identities. */
export function ProjectManagement({
  project,
  platform,
  onChanged,
  onDeleted,
  onRestored,
  onRefresh,
}: {
  project: ProjectSummary;
  platform: CortoPlatform;
  onChanged: (project: Project) => void;
  onDeleted: (id: string) => void;
  onRestored: (project: Project) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState(false);
  const [versions, setVersions] = useState<ProjectVersion[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      onRefresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "This project operation failed",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!platform.projectAction) return null;
  return (
    <div className="project-management">
      <button
        className="text-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        Manage {project.name}
      </button>
      {open && (
        <div className="tool-fields">
          <label className="field-label">
            Film name
            <input
              aria-label={`Rename ${project.name}`}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="tool-button-row">
            <button
              className="button secondary"
              disabled={busy || !name.trim()}
              onClick={() => {
                void run(async () => {
                  const changed = await platform.projectAction!({
                    operation: "rename",
                    id: project.id,
                    name: name.trim(),
                  });
                  if (changed) onChanged(changed);
                });
              }}
            >
              Rename film
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                void run(async () => {
                  const copy = await platform.projectAction!({
                    operation: "duplicate",
                    id: project.id,
                  });
                  if (copy) onRestored(copy);
                });
              }}
            >
              Duplicate film
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setRemove(true)}
            >
              Delete film
            </button>
            <button
              className="text-button"
              disabled={busy || !platform.listVersions}
              onClick={() => {
                void run(async () =>
                  setVersions(await platform.listVersions!(project.id)),
                );
              }}
            >
              Version history
            </button>
          </div>
          {remove && (
            <div className="delete-confirmation">
              <p>
                Remove this film from My films? Original media stays in the
                local workspace.
              </p>
              <button
                className="button secondary"
                onClick={() => setRemove(false)}
              >
                Keep film
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  void run(async () => {
                    await platform.projectAction!({
                      operation: "delete",
                      id: project.id,
                    });
                    onDeleted(project.id);
                  });
                }}
              >
                Remove from My films
              </button>
            </div>
          )}
          {versions && (
            <div className="version-list">
              <strong>Last {versions.length} saved versions</strong>
              {!versions.length && (
                <p>A version is kept when a saved film changes.</p>
              )}
              {versions.map((version) => (
                <button
                  className="text-button"
                  disabled={busy}
                  key={version.id}
                  onClick={() => {
                    void run(async () => {
                      const restored = await platform.restoreVersion!(
                        project.id,
                        version.id,
                      );
                      onRestored(restored);
                    });
                  }}
                >
                  {new Date(version.savedAt).toLocaleString()} ·{" "}
                  {version.sceneCount} scenes · Restore as copy
                </button>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
