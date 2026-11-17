import { useEffect, useState } from "react";
import { Film, FolderOpen, RotateCcw } from "lucide-react";
import type { ProjectSummary } from "../../contracts/platform";
import type { CortoPlatform } from "../platform/types";
import { formatTime } from "../domain/timeline";
import { Modal } from "./primitives";
import { posterFromUrl } from "../media/import";
import type { Project } from "../../contracts/project";
import { ProjectManagement } from "./ProjectManagement";

function ProjectThumbnail({ poster }: { poster?: string }) {
  if (!poster)
    return (
      <div className="project-thumbnail">
        <Film size={28} />
      </div>
    );
  return (
    <div className="project-thumbnail">
      <img src={poster} alt="" />
    </div>
  );
}

/** A local catalogue: choosing recovery always opens a separate editable copy. */
export function ProjectHome({
  platform,
  onOpen,
  onClose,
  onNew,
  onPortable,
  onChanged,
  onDeleted,
  onRestored,
}: {
  platform: CortoPlatform;
  onOpen: (id: string, recover: boolean) => void;
  onClose: () => void;
  onNew: () => void;
  onPortable: () => void;
  onChanged: (project: Project) => void;
  onDeleted: (id: string) => void;
  onRestored: (project: Project) => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void platform
      .listProjects()
      .then(async (value) => {
        if (cancelled) return;
        setProjects(value);
        // Decode one poster at a time so a catalogue never holds many full-size phone photos in memory.
        for (const project of value) {
          if (cancelled) break;
          if (!project.thumbnail) continue;
          try {
            const url = await platform.assetUrl(project.thumbnail.id);
            const poster = await posterFromUrl(project.thumbnail, url);
            if (!cancelled && poster)
              setPosters((previous) => ({ ...previous, [project.id]: poster }));
          } catch {
            /* Missing media keeps its placeholder; opening the film reports its recovery path. */
          }
        }
      })
      .catch((failure) => {
        if (!cancelled) setError(String(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [platform, refresh]);
  return (
    <Modal title="Your films" onClose={onClose} className="project-home">
      <p className="modal-introduction">
        Saved on this device. Take a portable copy with you for a backup or
        another computer.
      </p>
      <div className="dialog-toolbar">
        <button className="button primary" onClick={onNew}>
          New film
        </button>
        <button className="button secondary" onClick={onPortable}>
          <FolderOpen size={16} />
          Open portable project
        </button>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {!projects && !error && <p role="status">Opening your local films…</p>}
      {projects?.length === 0 && (
        <p>No saved films yet. Start one and Corto will keep it here.</p>
      )}
      <div className="project-grid">
        {projects?.map((project) => (
          <article className="saved-film" key={project.id}>
            <ProjectManagement
              project={project}
              platform={platform}
              onChanged={onChanged}
              onDeleted={onDeleted}
              onRestored={onRestored}
              onRefresh={() => setRefresh((value) => value + 1)}
            />
            <button
              className="saved-film-open"
              disabled={!!project.unavailableReason}
              onClick={() => onOpen(project.id, false)}
              aria-label={`Open ${project.name}`}
            >
              <ProjectThumbnail poster={posters[project.id]} />
              <strong>{project.name}</strong>
              <span>
                {project.sceneCount} scenes · {formatTime(project.duration)}
              </span>
              <small>{new Date(project.updatedAt).toLocaleString()}</small>
            </button>
            {project.unavailableReason && (
              <p className="dialog-note">{project.unavailableReason}</p>
            )}
            {project.hasRecovery && (
              <button
                className="text-button"
                onClick={() => onOpen(project.id, true)}
                aria-label={`Recover previous edit of ${project.name}`}
              >
                <RotateCcw size={14} />
                Recover previous edit as a copy
              </button>
            )}
          </article>
        ))}
      </div>
    </Modal>
  );
}
