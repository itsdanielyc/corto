import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Film,
  FolderOpen,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
} from "lucide-react";
import type { ProjectSummary } from "../../contracts/platform";
import type { CortoPlatform } from "../platform/types";
import { formatTime } from "../domain/timeline";
import { posterFromUrl } from "../media/import";
import type { Project } from "../../contracts/project";
import { ProjectManagement } from "./ProjectManagement";
import { THEMES } from "../domain/slideshow";

export type TemplateTheme = keyof typeof THEMES;

/** "Edited 3 hours ago" in the person's language, falling back to a date. */
function editedLabel(updatedAt: string, locale: string): string {
  const seconds = (new Date(updatedAt).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  try {
    const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const [unit, size] of units)
      if (Math.abs(seconds) >= size)
        return format.format(Math.round(seconds / size), unit);
    return format.format(0, "minute");
  } catch {
    return new Date(updatedAt).toLocaleString();
  }
}

function ProjectThumbnail({ poster }: { poster?: string }) {
  return (
    <span className="project-thumbnail">
      {poster ? (
        <img src={poster} alt="" draggable={false} />
      ) : (
        <Film size={26} strokeWidth={1.5} aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * Films: every local film, plus ways to start a new one. A full view rather
 * than a dialog, so it reads as a place you go back to. Like every miille app
 * it is a grey desk holding a white sheet (docs/design/miille.md): the ways to
 * start sit on the desk, in the column the editor uses for its library, and
 * your films are the page. Choosing recovery always opens a separate copy.
 */
export function ProjectHome({
  platform,
  currentId,
  onOpen,
  onClose,
  onNew,
  onPortable,
  onSlideshow,
  onTemplate,
  onChanged,
  onDeleted,
  onRestored,
  onSettings,
}: {
  platform: CortoPlatform;
  currentId: string;
  onOpen: (id: string, recover: boolean) => void;
  onClose: () => void;
  onNew: () => void;
  onPortable: () => void;
  onSlideshow: () => void;
  onTemplate: (theme: TemplateTheme) => void;
  onChanged: (project: Project) => void;
  onDeleted: (id: string) => void;
  onRestored: (project: Project) => void;
  onSettings: () => void;
}) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const locale = document.documentElement.lang || navigator.language;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]"))
        onClose();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
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
  const themes = Object.keys(THEMES) as TemplateTheme[];
  return (
    <section className="films-home" aria-labelledby="films-heading">
      <nav className="home-sidebar" aria-label={t("Start a film")}>
        <button className="home-back" onClick={onClose}>
          <span className="home-back-icon" aria-hidden="true">
            <ArrowLeft size={16} />
          </span>
          {t("Back to my film")}
        </button>
        <p className="home-group" aria-hidden="true">
          {t("Start")}
        </p>
        <button className="start-card start-empty" onClick={onNew}>
          <span className="start-art" aria-hidden="true">
            <Plus size={18} />
          </span>
          <span className="start-text">
            <strong>{t("New film")}</strong>
            <small aria-hidden="true">{t("Start empty")}</small>
          </span>
        </button>
        <button className="start-card start-slideshow" onClick={onSlideshow}>
          <span className="start-art" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <span className="start-text">
            <strong>{t("Slideshow")}</strong>
            <small aria-hidden="true">{t("From your photos")}</small>
          </span>
        </button>
        <p className="home-group" aria-hidden="true">
          {t("Templates")}
        </p>
        {themes.map((theme) => (
          <button
            key={theme}
            className="start-card start-template"
            aria-label={`${t(THEMES[theme].name)} ${t("template")}`}
            onClick={() => onTemplate(theme)}
          >
            {/* Monochrome on the brand tiles: the typeface is the template's character. */}
            <span
              aria-hidden="true"
              className={`start-art template-art caption-${THEMES[theme].style}`}
              data-light={THEMES[theme].background === "#e8e5dd"}
            >
              Aa
            </span>
            <span className="start-text">
              <strong>{t(THEMES[theme].name)}</strong>
            </span>
          </button>
        ))}
        <span className="home-spacer" />
        <button className="home-settings" onClick={onSettings}>
          <Settings size={18} aria-hidden="true" />
          {t("Settings")}
        </button>
      </nav>
      <div className="home-sheet">
        <div className="home-scroll">
          <div className="home-content">
            <header className="home-head">
              <div>
                <h1 id="films-heading" ref={heading} tabIndex={-1}>
                  {t("Films")}
                </h1>
                <p className="home-lede">
                  {t("Pick up where you left off, or start something new.")}
                </p>
              </div>
              <button className="button secondary large" onClick={onPortable}>
                <FolderOpen size={16} aria-hidden="true" />
                {t("Open portable project")}
              </button>
            </header>
            <h2 className="home-section-title">{t("Recent")}</h2>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
            {!projects && !error && (
              <p role="status" className="home-note">
                {t("Opening your films…")}
              </p>
            )}
            {projects?.length === 0 && (
              <div className="home-empty">
                <span className="home-empty-art" aria-hidden="true">
                  <Film size={20} />
                </span>
                <p>{t("Films you make appear here.")}</p>
              </div>
            )}
            <div className="project-grid">
              {projects?.map((project) => (
                <article
                  className={`saved-film ${project.id === currentId ? "current" : ""}`}
                  key={project.id}
                >
                  <button
                    className="saved-film-open"
                    disabled={!!project.unavailableReason}
                    onClick={() => onOpen(project.id, false)}
                    aria-label={t(`Open ${project.name}`)}
                  >
                    <ProjectThumbnail poster={posters[project.id]} />
                    <strong>{project.name}</strong>
                    <span>
                      {project.sceneCount === 1
                        ? t("1 scene")
                        : `${project.sceneCount}${t(" scenes")}`}
                      {t(" · ")}
                      {formatTime(project.duration)}
                      {t(" · ")}
                      {editedLabel(project.updatedAt, locale)}
                    </span>
                  </button>
                  {project.id === currentId && (
                    <span className="badge current-badge">{t("Open now")}</span>
                  )}
                  <ProjectManagement
                    project={project}
                    platform={platform}
                    onChanged={onChanged}
                    onDeleted={onDeleted}
                    onRestored={onRestored}
                    onRefresh={() => setRefresh((value) => value + 1)}
                  />
                  {project.unavailableReason && (
                    <p className="dialog-note">{project.unavailableReason}</p>
                  )}
                  {project.hasRecovery && (
                    <button
                      className="text-button recover-button"
                      onClick={() => onOpen(project.id, true)}
                      aria-label={t(`Recover previous edit of ${project.name}`)}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      {t("Recover previous edit as a copy")}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
