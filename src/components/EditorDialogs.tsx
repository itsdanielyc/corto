import { ArrowRight, ShieldCheck } from "lucide-react";
import packageInfo from "../../package.json";
import { ExportDialog } from "./ExportDialog";
import { Modal } from "./primitives";
import type { Project } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";

export type EditorDialog = "new" | "open" | "help" | "about" | "export" | null;
interface EditorDialogsProperties {
  dialog: EditorDialog;
  project: Project;
  platform: CortoPlatform;
  onClose: () => void;
  onSave: () => void;
  onTransition: () => void;
}

/** Present project, help and export dialogs without owning editing or persistence state. */
export function EditorDialogs({
  dialog,
  project,
  platform,
  onClose,
  onSave,
  onTransition,
}: EditorDialogsProperties) {
  return (
    <>
      {(dialog === "new" || dialog === "open") && (
        <Modal
          title={
            dialog === "new" ? "Start a new film?" : "Open another project?"
          }
          onClose={onClose}
        >
          <p className="modal-introduction">
            Save a portable copy if you want to return to this film. Your source
            files stay safe.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button secondary" onClick={onSave}>
              Save a copy
            </button>
            <button className="button primary" onClick={onTransition}>
              {dialog === "new" ? "Start new film" : "Choose project"}
            </button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal title="A few helpful shortcuts." onClose={onClose}>
          <p className="modal-introduction">Keep your hands on the story.</p>
          <dl className="shortcuts">
            {[
              ["Play / pause", "Space"],
              ["Undo", "⌘ / Ctrl Z"],
              ["Redo", "⌘ / Ctrl Shift Z"],
              ["Save a portable copy", "⌘ / Ctrl S"],
              ["Open a project", "⌘ / Ctrl O"],
              ["Delete selected scene", "Delete"],
              ["Move selected scene", "Alt ← / →"],
            ].map(([label, key]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="help-note">
            Drag scenes to reorder them. Your latest edits save locally. Use a
            portable copy to move a project to another device.
          </p>
        </Modal>
      )}
      {dialog === "about" && (
        <Modal
          title="Small films. Lasting memories."
          onClose={onClose}
          className="about-dialog"
        >
          <img
            src={`${import.meta.env.BASE_URL}brand/corto-lockup-black.svg`}
            alt="Corto"
          />
          <p className="modal-introduction">
            Corto by miille · {packageInfo.version}
            <br />A home for your photos, clips, music and stories.
          </p>
          <p>
            <ShieldCheck size={16} />
            No account. No uploads. No watermark.
          </p>
          <p className="help-note">
            Desktop: local MP4 export with FFmpeg. Web: recording format depends
            on your browser. Browser storage can be cleared by your browser;
            keep a portable .corto copy of films you want to preserve.
          </p>
          <details>
            <summary>Example media & acknowledgements</summary>
            <p>
              Photography: Finge Holden, Dawid Tkocz and Roger Benz, used under
              the Unsplash License. “Quiet morning” is original CC0 music. Corto
              uses Electron, React, Manrope, DM Serif Display, Lucide and
              FFmpeg; third-party notices and source information ship with the
              desktop application.
            </p>
          </details>
          <a
            href="https://github.com/itsdanielyc/corto"
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            Source code & releases
            <ArrowRight size={14} />
          </a>
        </Modal>
      )}
      {dialog === "export" && (
        <ExportDialog project={project} platform={platform} onClose={onClose} />
      )}
    </>
  );
}
