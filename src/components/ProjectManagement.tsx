import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { ProjectSummary } from "../../contracts/platform";
import type { Project } from "../../contracts/project";
import type { ProjectVersion } from "../../contracts/services";
import type { CortoPlatform } from "../platform/types";
/**
 * Manage catalogue metadata and restore history into separate identities.
 * A ⋯ button on the poster opens a small floating panel, so the grid of films
 * never shifts while you rename, duplicate or remove one.
 */
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
  const t = useT();
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
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  if (!platform.projectAction) return null;
  return (
    <div
      className="project-management"
      ref={panel}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="film-more"
        onClick={() => {
          if (!open) {
            setName(project.name);
            setRemove(false);
            setVersions(null);
            setError("");
          }
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label={t("Manage ") + project.name}
        title={t("Manage ") + project.name}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="tool-fields film-panel">
          <label className="field-label">
            {t("Film name")}
            <input
              aria-label={t(`Rename ${project.name}`)}
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
              {t("Rename film")}
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
              {t("Duplicate film")}
            </button>
            <button
              className="text-button danger-text"
              disabled={busy}
              onClick={() => setRemove(true)}
            >
              {t("Delete film")}
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
              {t("Version history")}
            </button>
          </div>
          {remove && (
            <div className="delete-confirmation">
              <p>
                {t(
                  "Remove this film from My films? Original media stays in the local workspace.",
                )}
              </p>
              <button
                className="button secondary"
                onClick={() => setRemove(false)}
              >
                {t("Keep film")}
              </button>
              <button
                className="button danger"
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
                {t("Remove from My films")}
              </button>
            </div>
          )}
          {versions && (
            <div className="version-list">
              <strong>
                {t("Last ")}
                {versions.length}
                {t(" saved versions")}
              </strong>
              {!versions.length && (
                <p>{t("A version is kept when a saved film changes.")}</p>
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
                  {new Date(version.savedAt).toLocaleString()}
                  {t(" \u00B7")} {version.sceneCount}
                  {t(" scenes \u00B7 Restore as copy")}
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
