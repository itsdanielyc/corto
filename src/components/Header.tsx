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
}: Pick<HeaderProperties, "name" | "onName"> & { disabled: boolean }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return (
    <input
      className="project-name"
      aria-label="Project name"
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
        aria-label="Corto home"
        onClick={(event) => {
          event.preventDefault();
          properties.onAbout();
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
          {statusLabels[properties.status]}
        </span>
      </div>
      <div className="header-spacer" />
      <div className="history-actions">
        <IconButton
          icon={Undo2}
          label="Undo"
          disabled={!properties.canUndo || properties.busy}
          onClick={properties.onUndo}
        />
        <IconButton
          icon={Redo2}
          label="Redo"
          disabled={!properties.canRedo || properties.busy}
          onClick={properties.onRedo}
        />
      </div>
      <div className="header-divider" />
      <div className="project-menu-wrap" ref={menu}>
        <button
          ref={trigger}
          className="icon-button"
          aria-label="Project actions"
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
            aria-label="Project actions"
          >
            <button role="menuitem" onClick={action(properties.onNew)}>
              <FilePlus2 />
              New film
            </button>
            <button role="menuitem" onClick={action(properties.onOpen)}>
              <FolderOpen />
              Open project<span>⌘ / Ctrl O</span>
            </button>
            <button role="menuitem" onClick={action(properties.onSave)}>
              <Save />
              Save portable copy<span>⌘ / Ctrl S</span>
            </button>
            <hr />
            <button role="menuitem" onClick={action(properties.onHelp)}>
              <Keyboard />
              Keyboard shortcuts
            </button>
            <button role="menuitem" onClick={action(properties.onAbout)}>
              <CircleHelp />
              About Corto
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
        Export movie
        <ChevronDown size={14} />
      </button>
    </header>
  );
}
