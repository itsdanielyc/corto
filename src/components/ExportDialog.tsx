import { useRef, useState } from "react";
import {
  Check,
  Download,
  FolderOpen,
  LoaderCircle,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import type { MovieResult, ExportProgress } from "../../contracts/platform";
import type { ExportResolution, Project } from "../../contracts/project";
import { filmDuration, formatTime, frameDimensions } from "../domain/timeline";
import { browserRecordingFormat } from "../export/format";
import type { CortoPlatform } from "../platform/types";
import { createCaptionOverlays } from "../preview/captions";
import { Modal } from "./primitives";

export function ExportDialog({
  project,
  platform,
  onClose,
}: {
  project: Project;
  platform: CortoPlatform;
  onClose: () => void;
}) {
  const [resolution, setResolution] = useState<ExportResolution>("1080p");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<MovieResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const surface = useRef<HTMLCanvasElement>(null);
  const browserFormat = browserRecordingFormat();
  const native = platform.kind === "native";
  const format = native ? "MP4" : browserFormat?.label;
  const dimensions = frameDimensions(project.ratio, resolution);

  const close = () => {
    if (abort.current) abort.current.abort();
    else onClose();
  };
  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setProgress({ fraction: 0, message: "Getting your film ready" });
    try {
      const overlays = native
        ? await createCaptionOverlays(project, resolution, controller.signal)
        : [];
      const movie = await platform.renderMovie(
        { project, resolution, overlays },
        setProgress,
        controller.signal,
        surface.current ?? undefined,
      );
      if (movie) setResult(movie);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "The movie could not be exported",
        );
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  return (
    <Modal
      title={result ? "A little film. All yours." : "Make it a movie."}
      onClose={close}
      className="export-dialog"
    >
      {!native && (
        <canvas
          ref={surface}
          className="export-render-preview"
          hidden={!progress}
          width={dimensions.width}
          height={dimensions.height}
          aria-label="Movie being exported"
        />
      )}
      {result ? (
        <div className="export-success">
          <div className="success-symbol">
            <Check size={28} />
          </div>
          <h3>
            Ready for the big screen.
            <br />
            Or the family group chat.
          </h3>
          <p>{result.fileName}</p>
          <span>
            {result.location === "file"
              ? "Saved to your chosen folder."
              : "Your browser has started the download."}{" "}
            No watermark, just your story.
          </span>
          {result.location === "file" && (
            <button
              className="button secondary"
              onClick={() => {
                void platform
                  .revealExport()
                  .catch((failure) => setError(String(failure)));
              }}
            >
              <FolderOpen size={16} />
              Show in folder
            </button>
          )}
          <button className="button primary" onClick={onClose}>
            Back to my film
          </button>
        </div>
      ) : (
        <>
          <p className="modal-introduction">
            A birthday, a big adventure, an ordinary Sunday.
            <br />
            Some moments deserve a replay.
          </p>
          <div className="export-summary">
            <Monitor size={23} />
            <div>
              <strong>{project.name}</strong>
              <span>
                {project.scenes.length} scenes ·{" "}
                {formatTime(filmDuration(project.scenes))} ·{" "}
                {project.ratio === "landscape"
                  ? "16:9"
                  : project.ratio === "portrait"
                    ? "9:16"
                    : "1:1"}
              </span>
            </div>
            <span className="format-badge">{format ?? "Unavailable"}</span>
          </div>
          <fieldset className="export-options" disabled={!!progress}>
            <legend>Choose your quality</legend>
            {(
              [
                {
                  id: "1080p",
                  title: "Full HD",
                  subtitle: "Beautiful on a bigger screen",
                },
                {
                  id: "720p",
                  title: "HD",
                  subtitle: "A smaller file, easy to share",
                },
              ] as const
            ).map((option) => (
              <label
                key={option.id}
                className={
                  resolution === option.id
                    ? "resolution-option selected"
                    : "resolution-option"
                }
              >
                <input
                  type="radio"
                  name="resolution"
                  value={option.id}
                  checked={resolution === option.id}
                  onChange={() => setResolution(option.id)}
                />
                <div>
                  <strong>
                    {option.title}
                    <small>{option.id}</small>
                  </strong>
                  <span>{option.subtitle}</span>
                </div>
                <span className="radio-visual" />
              </label>
            ))}
          </fieldset>
          <p className="export-details">
            {dimensions.width} × {dimensions.height} · 30 fps ·{" "}
            {native
              ? "H.264 video + AAC audio"
              : format === "MP4"
                ? "MP4 browser recording"
                : "WebM browser recording"}
          </p>
          {!native && (
            <div className="web-export-note">
              Browser export runs in real time. Keep this tab visible until it
              finishes.{format === "WebM" && " For MP4, use the desktop app."}
            </div>
          )}
          {!format && (
            <p className="inline-error">
              This browser cannot record video. Use a current desktop browser or
              the Corto desktop app.
            </p>
          )}
          {progress ? (
            <div className="export-progress">
              <div>
                <span>
                  <LoaderCircle size={14} className="spin" />
                  {progress.message}
                </span>
                <strong>{Math.floor(progress.fraction * 100)}%</strong>
              </div>
              <progress
                aria-label="Movie export progress"
                max="1"
                value={progress.fraction}
              />
              <button
                className="text-button"
                onClick={() => abort.current?.abort()}
              >
                Cancel export
              </button>
            </div>
          ) : (
            <button
              className="button primary export-start"
              disabled={!format}
              onClick={() => {
                void start();
              }}
            >
              <Download size={17} />
              Export {format ?? "movie"}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="export-privacy">
        <ShieldCheck size={14} />
        Made on your device. Kept off the cloud.
      </div>
    </Modal>
  );
}
