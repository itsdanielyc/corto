import { useT } from "../i18n/locale";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  CircleHelp,
  FilePlus2,
  FolderOpen,
  Keyboard,
  LoaderCircle,
  MoreHorizontal,
  Redo2,
  Save,
  Search,
  Undo2,
} from "lucide-react";
import type { SaveStatus } from "../hooks/use-project";
import { IconButton } from "./primitives";
import { CortoMark } from "./PlayMark";
import { shortcutLabel } from "./shortcut-label";

import type { WindowFrame } from "../../contracts/platform";

interface HeaderProperties {
  projectId: string;
  name: string;
  onName: (name: string) => void;
  status: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
  canExport: boolean;
  frame: WindowFrame;
  /** Fraction of the running background export, or null when none runs. */
  exportProgress: number | null;
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
  onCommands: () => void;
}

/** Status words only: what happened, not where the film lives. */
const statusLabels: Record<SaveStatus, string> = {
  loading: "Opening",
  pending: "Unsaved changes",
  saving: "Saving",
  saved: "Saved",
  error: "Not saved",
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
    <span className="project-name-wrap" data-value={draft || " "}>
      <input
        className="project-name"
        aria-label={t("Project name")}
        disabled={disabled}
        maxLength={80}
        size={1}
        spellCheck={false}
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
    </span>
  );
}

function SaveState({ status }: { status: SaveStatus }) {
  const t = useT();
  return (
    <span
      className={`save-state ${status === "error" ? "save-error" : ""}`}
      data-status={status}
      data-testid="save-status"
      aria-live="polite"
    >
      {status === "saved" ? (
        <Check size={13} aria-hidden="true" />
      ) : status === "saving" || status === "loading" ? (
        <LoaderCircle size={13} className="spin" aria-hidden="true" />
      ) : (
        <span className="status-dot" aria-hidden="true" />
      )}
      {t(statusLabels[status])}
    </span>
  );
}

/** The title bar: where you are, whether it is saved, and the way out (Export). */
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
    menu.current
      ?.querySelector<HTMLElement>("[role=menuitem]")
      ?.focus({ preventScroll: true });
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
  const exporting = properties.exportProgress !== null;
  return (
    <header className="app-header" data-frame={properties.frame}>
      <button
        className="films-button"
        aria-label={t("My films")}
        disabled={properties.busy}
        onClick={properties.onProjects}
      >
        <CortoMark className="films-mark" />
        <span>{t("Films")}</span>
      </button>
      <span className="crumb-divider" aria-hidden="true">
        /
      </span>
      <div className="project-heading">
        <ProjectName
          key={properties.projectId}
          name={properties.name}
          onName={properties.onName}
          disabled={properties.busy}
        />
        <SaveState status={properties.status} />
      </div>
      <div className="header-spacer" />
      <button
        className="command-search"
        onClick={properties.onCommands}
        aria-label={t("Search commands")}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search size={15} aria-hidden="true" />
        <span>{t("Search or run a command")}</span>
        <kbd>{shortcutLabel("K")}</kbd>
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
      <div className="project-menu-wrap" ref={menu}>
        <button
          ref={trigger}
          className="icon-button"
          aria-label={t("Project actions")}
          title={t("Project actions")}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={properties.busy}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
        {menuOpen && (
          <div
            className="project-menu"
            role="menu"
            aria-label={t("Project actions")}
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
              event.preventDefault();
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "[role=menuitem]",
                ),
              );
              const index = items.indexOf(
                document.activeElement as HTMLElement,
              );
              const next =
                (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length;
              items[next]?.focus();
            }}
          >
            <button role="menuitem" onClick={action(properties.onProjects)}>
              <FolderOpen aria-hidden="true" />
              {t("My films")}
            </button>
            <button role="menuitem" onClick={action(properties.onNew)}>
              <FilePlus2 aria-hidden="true" />
              {t("New film")}
            </button>
            <button role="menuitem" onClick={action(properties.onOpen)}>
              <FolderOpen aria-hidden="true" />
              {t("Open project")}
              <span className="menu-shortcut">{shortcutLabel("O")}</span>
            </button>
            <button role="menuitem" onClick={action(properties.onSave)}>
              <Save aria-hidden="true" />
              {t("Save portable copy")}
              <span className="menu-shortcut">{shortcutLabel("S")}</span>
            </button>
            <hr />
            <button role="menuitem" onClick={action(properties.onSound)}>
              {t("Sound & narration")}
            </button>
            <button role="menuitem" onClick={action(properties.onSubtitles)}>
              {t("Timed subtitles")}
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
            <hr />
            <button role="menuitem" onClick={action(properties.onSettings)}>
              {t("Settings & defaults")}
            </button>
            <button role="menuitem" onClick={action(properties.onHelp)}>
              <Keyboard aria-hidden="true" />
              {t("Keyboard shortcuts")}
            </button>
            <button role="menuitem" onClick={action(properties.onAbout)}>
              <CircleHelp aria-hidden="true" />
              {t("About Corto")}
            </button>
          </div>
        )}
      </div>
      <button
        className={`button primary export-button ${exporting ? "exporting" : ""}`}
        disabled={!properties.canExport || properties.busy}
        onClick={properties.onExport}
        aria-label={t("Export movie")}
        style={
          exporting
            ? ({
                "--export-progress": `${Math.round((properties.exportProgress ?? 0) * 100)}%`,
              } as CSSProperties)
            : undefined
        }
      >
        <span>{t("Export")}</span>
        {exporting && (
          <span className="export-button-progress" aria-hidden="true" />
        )}
      </button>
    </header>
  );
}
