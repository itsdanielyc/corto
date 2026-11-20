import { useT } from "../i18n/locale";
import { ArrowUpRight } from "lucide-react";
import packageInfo from "../../package.json";
import { ExportDialog } from "./ExportDialog";
import { Modal } from "./primitives";
import type { Project } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import type { MediaResources } from "../hooks/use-resources";
import { shortcutLabel } from "./shortcut-label";
export type EditorDialog =
  | "new"
  | "open"
  | "help"
  | "about"
  | "export"
  | "projects"
  | "sound"
  | "subtitles"
  | "slideshow"
  | "film-tools"
  | "settings"
  | "capture"
  | null;
/** Dialogs that sit beside the film as panels rather than blocking it. */
export const PANEL_DIALOGS: ReadonlySet<EditorDialog> = new Set([
  "sound",
  "subtitles",
  "film-tools",
]);
interface EditorDialogsProperties {
  dialog: EditorDialog;
  project: Project;
  platform: CortoPlatform;
  resources: MediaResources;
  onClose: () => void;
  onSave: () => void;
  onTransition: () => void;
  renderMovie?: CortoPlatform["renderMovie"];
  time?: number;
  selectedIds?: ReadonlySet<string>;
}
const SHORTCUTS: readonly (readonly [string, string])[] = [
  ["Play / pause", "Space"],
  ["Search or run a command", shortcutLabel("K")],
  ["Undo", shortcutLabel("Z")],
  ["Redo", shortcutLabel("Z", true)],
  ["Save a portable copy", shortcutLabel("S")],
  ["Open a project", shortcutLabel("O")],
  ["Delete selected scene", "Delete"],
  ["Move selected scene", "Alt ← / →"],
  ["Split scene", "S"],
  ["Duplicate scene", shortcutLabel("D")],
  ["Copy / cut / paste scenes", `${shortcutLabel("C")} / X / V`],
  ["Select all scenes", shortcutLabel("A")],
  ["First / last frame", "Home / End"],
  ["Step one frame", "← / →"],
];
/** Present project, help and export dialogs without owning editing or persistence state. */
export function EditorDialogs({
  dialog,
  project,
  platform,
  resources,
  onClose,
  onSave,
  onTransition,
  renderMovie,
  time,
  selectedIds,
}: EditorDialogsProperties) {
  const t = useT();
  return (
    <>
      {(dialog === "new" || dialog === "open") && (
        <Modal
          title={t(
            dialog === "new" ? "Start a new film?" : "Open another project?",
          )}
          onClose={onClose}
          className="confirm-dialog"
        >
          <p className="modal-introduction">
            {t("This film stays in Films.")}
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={onClose}>
              {t("Cancel")}
            </button>
            <button className="button secondary" onClick={onSave}>
              {t("Save a copy")}
            </button>
            <button className="button primary" onClick={onTransition}>
              {dialog === "new" ? t("Start new film") : t("Choose project")}
            </button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal title={t("Keyboard shortcuts")} onClose={onClose}>
          <dl className="shortcuts">
            {SHORTCUTS.map(([label, key]) => (
              <div key={label}>
                <dt>{t(label)}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="help-note">
            {t(
              "Drag scenes to reorder them. Drag words and framing on the picture.",
            )}
          </p>
        </Modal>
      )}
      {dialog === "about" && (
        <Modal
          title={t("About Corto")}
          onClose={onClose}
          className="about-dialog"
        >
          <img
            className="about-lockup"
            src={`${import.meta.env.BASE_URL}brand/corto-lockup-black.svg`}
            alt="Corto"
          />
          <p className="modal-introduction">
            {t("Corto by miille · ")}
            {packageInfo.version}
          </p>
          {platform.kind !== "native" && (
            <p className="help-note">
              {t(
                "Browsers can clear their storage. Keep a portable .corto copy of films you want to preserve.",
              )}
            </p>
          )}
          <details>
            <summary>{t("Example media & acknowledgements")}</summary>
            <p className="help-note">
              {t(
                "Photography: Finge Holden, Dawid Tkocz and Roger Benz, used under the Unsplash License. “Quiet morning” is original CC0 music. Corto uses Electron, React, Inter, Manrope, DM Serif Display, Lucide and FFmpeg; third-party notices and source information ship with the desktop application.",
              )}
            </p>
          </details>
          <a
            href="https://github.com/itsdanielyc/corto"
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            {t("Source code & releases")}
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </Modal>
      )}
      {dialog === "export" && (
        <ExportDialog
          project={project}
          platform={platform}
          resources={resources}
          onClose={onClose}
          renderMovie={renderMovie}
          time={time}
          selectedIds={selectedIds}
        />
      )}
    </>
  );
}
