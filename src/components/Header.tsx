import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  FilePlus2,
  FolderOpen,
  Keyboard,
  LoaderCircle,
  MoreHorizontal,
  Redo2,
  Save,
  Undo2,
  CircleHelp,
} from "lucide-react";
import type { SaveStatus } from "../hooks/use-project";
import { IconButton } from "./primitives";
interface HeaderProperties {
  projectId: string;
  name: string;
  onName: (name: string) => void;
  status: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  canExport: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
  onHelp: () => void;
  onAbout: () => void;
  onProjects: () => void;
  onSound: () => void;
  onSubtitles: () => void;
  onSlideshow: () => void;
  onFilmTools: () => void;
  onSettings: () => void;
  onCapture: () => void;
}
const statusLabels: Record<SaveStatus, string> = {
  loading: "Opening local project",
  pending: "Unsaved changes",
  saving: "Saving locally",
  saved: "Saved on this device",
  error: "Local save unavailable",
};
function ProjectName({
  name,
  onName,
  disabled,
}: Pick<HeaderProperties, "name" | "onName"> & {
  disabled: boolean;
}) {
  const t = useT();
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return (
    <input
      className="project-name"
      aria-label={t("Project name")}
      disabled={disabled}
      maxLength={80}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onName(draft.trim() || "Untitled film")}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(name);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
export function Header(properties: HeaderProperties) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const pointer = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
    };
  }, [menuOpen]);
  const action = (callback: () => void) => () => {
    setMenuOpen(false);
    trigger.current?.focus();
    callback();
  };
  return (
    <header className="app-header">
      <a
        className="brand"
        href="#"
        aria-label={t("Corto home")}
        onClick={(event) => {
          event.preventDefault();
          properties.onProjects();
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}brand/corto-lockup-black.svg`}
          alt="Corto"
        />
      </a>
      <div className="header-divider" />
      <div className="project-heading">
        <ProjectName
          key={properties.projectId}
          name={properties.name}
          onName={properties.onName}
          disabled={properties.busy}
        />
        <span
          className={`save-state ${properties.status === "error" ? "save-error" : ""}`}
          data-testid="save-status"
          aria-live="polite"
        >
          {properties.status === "saved" ? (
            <Check size={12} />
          ) : properties.status === "saving" ||
            properties.status === "loading" ? (
            <LoaderCircle size={12} className="spin" />
          ) : (
            <span className="status-dot" />
          )}
          {t(statusLabels[properties.status])}
        </span>
      </div>
      <div className="header-spacer" />
      <button
        className="button secondary my-films-button"
        disabled={properties.busy}
        onClick={properties.onProjects}
      >
        <FolderOpen size={16} />
        {t("My films")}
      </button>
      <div className="history-actions">
        <IconButton
          icon={Undo2}
          label={t("Undo")}
          disabled={!properties.canUndo || properties.busy}
          onClick={properties.onUndo}
        />
        <IconButton
          icon={Redo2}
          label={t("Redo")}
          disabled={!properties.canRedo || properties.busy}
          onClick={properties.onRedo}
        />
      </div>
      <div className="header-divider" />
      <div className="project-menu-wrap" ref={menu}>
        <button
          ref={trigger}
          className="icon-button"
          aria-label={t("Project actions")}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={properties.busy}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MoreHorizontal size={20} />
        </button>
        {menuOpen && (
          <div
            className="project-menu"
            role="menu"
            aria-label={t("Project actions")}
          >
            <button role="menuitem" onClick={action(properties.onProjects)}>
              <FolderOpen />
              {t("My films")}
            </button>
            <button role="menuitem" onClick={action(properties.onNew)}>
              <FilePlus2 />
              {t("New film")}
            </button>
            <button role="menuitem" onClick={action(properties.onOpen)}>
              <FolderOpen />
              {t("Open project")}
              <span>{t("\u2318 / Ctrl O")}</span>
            </button>
            <button role="menuitem" onClick={action(properties.onSave)}>
              <Save />
              {t("Save portable copy")}
              <span>{t("\u2318 / Ctrl S")}</span>
            </button>
            <button role="menuitem" onClick={action(properties.onSound)}>
              {t("Sound & narration")}
            </button>
            <button role="menuitem" onClick={action(properties.onSlideshow)}>
              {t("Make a slideshow")}
            </button>
            <button role="menuitem" onClick={action(properties.onFilmTools)}>
              {t("Film tools & bulk edits")}
            </button>
            <button role="menuitem" onClick={action(properties.onCapture)}>
              {t("Record camera or screen")}
            </button>
            <button role="menuitem" onClick={action(properties.onSettings)}>
              {t("Settings & defaults")}
            </button>
            <button role="menuitem" onClick={action(properties.onSubtitles)}>
              {t("Timed subtitles")}
            </button>
            <hr />
            <button role="menuitem" onClick={action(properties.onHelp)}>
              <Keyboard />
              {t("Keyboard shortcuts")}
            </button>
            <button role="menuitem" onClick={action(properties.onAbout)}>
              <CircleHelp />
              {t("About Corto")}
            </button>
          </div>
        )}
      </div>
      <button
        className="button primary export-button"
        disabled={!properties.canExport || properties.busy}
        onClick={properties.onExport}
      >
        <Download size={16} />
        {t("Export movie")}
        <ChevronDown size={14} />
      </button>
    </header>
  );
}
