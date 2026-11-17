import { useT } from "../i18n/locale";
import { ArrowRight, ShieldCheck } from "lucide-react";
import packageInfo from "../../package.json";
import { ExportDialog } from "./ExportDialog";
import { Modal } from "./primitives";
import type { Project } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
export type EditorDialog =
  | "new"
  | "open"
  | "help"
  | "about"
  | "export"
  | "projects"
  | "sound"
  | "subtitles"
  | "scene-tools"
  | "slideshow"
  | "film-tools"
  | "settings"
  | "capture"
  | null;
interface EditorDialogsProperties {
  dialog: EditorDialog;
  project: Project;
  platform: CortoPlatform;
  onClose: () => void;
  onSave: () => void;
  onTransition: () => void;
  renderMovie?: CortoPlatform["renderMovie"];
  time?: number;
  selectedIds?: ReadonlySet<string>;
}
/** Present project, help and export dialogs without owning editing or persistence state. */
export function EditorDialogs({
  dialog,
  project,
  platform,
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
        >
          <p className="modal-introduction">
            {t(
              "Your current film will stay in My films on this device. Save a portable copy for a backup or another computer.",
            )}
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
        <Modal title={t("A few helpful shortcuts.")} onClose={onClose}>
          <p className="modal-introduction">
            {t("Keep your hands on the story.")}
          </p>
          <dl className="shortcuts">
            {[
              ["Play / pause", "Space"],
              ["Undo", "⌘ / Ctrl Z"],
              ["Redo", "⌘ / Ctrl Shift Z"],
              ["Save a portable copy", "⌘ / Ctrl S"],
              ["Open a project", "⌘ / Ctrl O"],
              ["Delete selected scene", "Delete"],
              ["Move selected scene", "Alt ← / →"],
              ["Split / duplicate scene", "S / ⌘ Ctrl D"],
              ["Copy / cut / paste scenes", "⌘ Ctrl C / X / V"],
              ["Select all scenes", "⌘ Ctrl A"],
              ["First / last frame", "Home / End"],
              ["Step one frame", "← / →"],
            ].map(([label, key]) => (
              <div key={t(label)}>
                <dt>{t(label)}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="help-note">
            {t(
              "Drag scenes to reorder them. Your latest edits save locally. Use a portable copy to move a project to another device.",
            )}
          </p>
        </Modal>
      )}
      {dialog === "about" && (
        <Modal
          title={t("Small films. Lasting memories.")}
          onClose={onClose}
          className="about-dialog"
        >
          <img
            src={`${import.meta.env.BASE_URL}brand/corto-lockup-black.svg`}
            alt="Corto"
          />
          <p className="modal-introduction">
            {t("Corto by miille \u00B7 ")}
            {packageInfo.version}
            <br />
            {t("A home for your photos, clips, music and stories.")}
          </p>
          <p>
            <ShieldCheck size={16} />
            {t("No account. No uploads. No watermark.")}
          </p>
          <p className="help-note">
            {t(
              "Desktop and web encode movies locally. Browser codec budgets apply to large films. Browser storage can be cleared by your browser; keep a portable .corto copy of films you want to preserve.",
            )}
          </p>
          <details>
            <summary>{t("Example media & acknowledgements")}</summary>
            <p>
              {t(
                "Photography: Finge Holden, Dawid Tkocz and Roger Benz, used under the Unsplash License. \u201CQuiet morning\u201D is original CC0 music. Corto uses Electron, React, Manrope, DM Serif Display, Lucide and FFmpeg; third-party notices and source information ship with the desktop application.",
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
            <ArrowRight size={14} />
          </a>
        </Modal>
      )}
      {dialog === "export" && (
        <ExportDialog
          project={project}
          platform={platform}
          onClose={onClose}
          renderMovie={renderMovie}
          time={time}
          selectedIds={selectedIds}
        />
      )}
    </>
  );
}
