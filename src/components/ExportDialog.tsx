import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FolderOpen,
  LoaderCircle,
  Monitor,
  Save,
  ShieldCheck,
} from "lucide-react";
import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
} from "../../contracts/platform";
import { parseProject, type Project } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import { filmDuration, formatTime, frameDimensions } from "../domain/timeline";
import { selectedFilm } from "../domain/selected-film";
import { browserRecordingFormat } from "../export/format";
import {
  EXPORT_PRESETS,
  exportBitrate,
  presetResolution,
} from "../export/presets";
import { Modal } from "./primitives";
import { OutputOptions } from "./tools/OutputOptions";
const RATIO_LABELS = {
  landscape: "16:9",
  portrait: "9:16",
  square: "1:1",
  classic: "4:3",
  feed: "4:5",
  cinema: "2.35:1",
} as const;
type RenderMovie = CortoPlatform["renderMovie"];
/** Export choices create immutable requests; the application queue owns jobs after the dialog closes. */
export function ExportDialog({
  project,
  platform,
  onClose,
  renderMovie,
  time = 0,
  selectedIds = new Set<string>(),
}: {
  project: Project;
  platform: CortoPlatform;
  onClose: () => void;
  renderMovie?: RenderMovie;
  time?: number;
  selectedIds?: ReadonlySet<string>;
}) {
  const t = useT();
  const [settings, setSettings] = useState(project.output);
  const [rangeMode, setRangeMode] = useState<"all" | "selection" | "range">(
    "all",
  );
  const total = filmDuration(project.scenes);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(total);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<MovieResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const surface = useRef<HTMLCanvasElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const native = platform.kind === "native";
  const browser = browserRecordingFormat();
  const format =
    native || browser?.label === "MP4"
      ? settings.format.toUpperCase()
      : browser?.label;
  const resolution = settings.resolution;
  const dimensions = frameDimensions(project.ratio, resolution);
  const preset = ["tv", "phone", "small"].includes(settings.preset)
    ? (settings.preset as keyof typeof EXPORT_PRESETS)
    : undefined;
  const seconds =
    rangeMode === "range"
      ? Math.max(0, rangeEnd - rangeStart)
      : rangeMode === "selection"
        ? filmDuration(
            project.scenes.filter((scene) => selectedIds.has(scene.id)),
          )
        : total;
  const videoBits =
    exportBitrate({ resolution, preset }) *
    (resolution === "2160p" ? 4 : 1) *
    (0.35 + settings.quality / 100);
  const estimatedBytes =
    settings.format === "wav"
      ? seconds * 48000 * 2 * 2
      : settings.format === "m4a"
        ? (seconds * 192000) / 8
        : (seconds * (videoBits + 192000)) / 8;
  const choosePreset = (id: keyof typeof EXPORT_PRESETS) =>
    setSettings((previous) => ({
      ...previous,
      preset: id,
      resolution: presetResolution(id),
      quality: id === "small" ? 50 : 70,
      fps: 30,
    }));
  const close = () => {
    if (browser?.label === "WebM" && abort.current) abort.current.abort();
    else onClose();
  };
  const start = async (sample = false) => {
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setProgress({ fraction: 0, message: "Getting your film ready" });
    try {
      let exporting = parseProject({ ...project, output: settings });
      if (!sample && rangeMode === "selection")
        exporting = selectedFilm(exporting, selectedIds);
      const sampleStart = Math.max(
        0,
        Math.min(time, Math.max(0, total - 0.25)),
      );
      const range = sample
        ? { start: sampleStart, end: Math.min(total, sampleStart + 5) }
        : rangeMode === "range"
          ? { start: rangeStart, end: rangeEnd }
          : undefined;
      const request: MovieRequest = {
        project: exporting,
        resolution,
        overlays: [],
        preset,
        sample,
        range,
      };
      const prepared = platform.prepareExport
        ? await platform.prepareExport(request)
        : request;
      if (!prepared) return;
      if (controller.signal.aborted) {
        await platform.disposeExport?.(prepared);
        controller.signal.throwIfAborted();
      }
      const movie = await (renderMovie ?? platform.renderMovie.bind(platform))(
        prepared,
        (value) => {
          if (mounted.current) setProgress(value);
        },
        controller.signal,
        surface.current ?? undefined,
      );
      if (movie && mounted.current) setResult(movie);
    } catch (failure) {
      if (!controller.signal.aborted && mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "The movie could not be exported",
        );
    } finally {
      abort.current = null;
      if (mounted.current) setProgress(null);
    }
  };
  return (
    <Modal
      title={t(result ? "A little film. All yours." : "Make it a movie.")}
      onClose={close}
      className="export-dialog"
    >
      {!native && browser?.label === "WebM" && (
        <canvas
          ref={surface}
          className="export-render-preview"
          hidden={!progress}
          {...dimensions}
          aria-label={t("Movie being exported")}
        />
      )}
      {result ? (
        <div className="export-success">
          <div className="success-symbol">
            <Check size={28} />
          </div>
          <h3>
            {t("Ready for the big screen.")}
            <br />
            {t("Or the family group chat.")}
          </h3>
          <p>{result.fileName}</p>
          <span>
            {result.location === "file"
              ? t("Saved to your chosen folder.")
              : t("Your browser has started the download.")}{" "}
            {t("No watermark, just your story.")}
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
              {t("Show in folder")}
            </button>
          )}
          <button className="button primary" onClick={onClose}>
            {t("Back to my film")}
          </button>
        </div>
      ) : (
        <>
          <p className="modal-introduction">
            {t("A birthday, a big adventure, an ordinary Sunday.")}
            <br />
            {t("Some moments deserve a replay.")}
          </p>
          <div className="export-summary">
            <Monitor size={23} />
            <div>
              <strong>{project.name}</strong>
              <span>
                {project.scenes.length}
                {t(" scenes \u00B7 ")}
                {formatTime(total)}
                {t(" \u00B7")} {RATIO_LABELS[project.ratio]}
              </span>
            </div>
            <span className="format-badge">{format ?? t("Unavailable")}</span>
          </div>
          <fieldset className="export-options" disabled={!!progress}>
            <legend>{t("Choose where to share")}</legend>
            {(["tv", "phone", "small"] as const).map((id) => {
              const option = EXPORT_PRESETS[id];
              return (
                <label
                  key={id}
                  className={
                    settings.preset === id
                      ? "resolution-option selected"
                      : "resolution-option"
                  }
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={id}
                    checked={settings.preset === id}
                    onChange={() => choosePreset(id)}
                  />
                  <div>
                    <strong>
                      {t(option.title)}
                      <small>{option.resolution}</small>
                    </strong>
                    <span>{t(option.subtitle)}</span>
                  </div>
                  <span className="radio-visual" />
                </label>
              );
            })}
            <OutputOptions
              settings={settings}
              onChange={setSettings}
              native={native}
              rangeMode={rangeMode}
              onRangeMode={setRangeMode}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={total}
              onRange={(start, end) => {
                setRangeStart(start);
                setRangeEnd(end);
              }}
              selectedCount={selectedIds.size}
            />
          </fieldset>
          <p className="export-details">
            {settings.format === "mp4" && (
              <>
                {dimensions.width}
                {t(" \u00D7 ")}
                {dimensions.height}
                {t(" \u00B7")}{" "}
                {settings.fps === "source"
                  ? t("source frame rate")
                  : `${settings.fps} fps`}{" "}
                {t("\u00B7")}{" "}
              </>
            )}
            {settings.format === "mp4"
              ? t("Local H.264 + AAC encoding")
              : settings.format === "gif"
                ? t("Animated GIF · up to 960 pixels, 15 fps")
                : settings.format === "wav"
                  ? t("Uncompressed PCM audio")
                  : t("AAC audio")}
          </p>
          <p className="dialog-note">
            {t("Estimated size: about ")}
            {(estimatedBytes / 1000000).toFixed(1)}
            {t(" MB. Actual size varies with the scenes.")}
            {settings.format === "gif" &&
              " GIF sizes vary considerably with movement."}{" "}
            {t("Aspect ratio stays ")}
            {project.ratio}
            {t(".")}
          </p>
          {!native && format && (
            <div className="web-export-note">
              {t(
                "Your movie is encoded on this device. No upload is needed. Large source files and long jobs work best in the desktop app.",
              )}
            </div>
          )}
          {!format && (
            <div>
              <p className="inline-error">
                {t(
                  "For MP4 export, open this project in Corto for desktop. Save a portable copy to take your media and edits with you.",
                )}
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  void platform
                    .savePortable(project)
                    .catch((failure) => setError(String(failure)));
                }}
              >
                <Save size={15} />
                {t("Save portable project")}
              </button>
            </div>
          )}
          {progress ? (
            <div className="export-progress">
              <div>
                <LoaderCircle className="spin" size={17} />
                <span>{progress.message}</span>
                <strong>
                  {Math.round(progress.fraction * 100)}
                  {t("%")}
                </strong>
              </div>
              <progress
                max={1}
                value={progress.fraction}
                aria-label={t("Movie export progress")}
              />
              <div className="tool-button-row">
                <button
                  className="button secondary"
                  onClick={() => abort.current?.abort()}
                >
                  {t("Cancel export")}
                </button>
                {browser?.label !== "WebM" && (
                  <button className="button primary" onClick={onClose}>
                    {t("Continue editing while exporting")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              className="button primary export-start"
              disabled={
                !format ||
                !project.scenes.length ||
                (rangeMode === "selection" && !selectedIds.size)
              }
              onClick={() => {
                void start();
              }}
            >
              <Download size={17} />
              {t("Export ")}
              {format ?? t("movie")}
            </button>
          )}
          {!progress && (
            <button
              className="text-button sample-export"
              disabled={!format}
              title={t("Starts at the current playhead")}
              onClick={() => {
                void start(true);
              }}
            >
              {t("Export 5-second sample at playhead")}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="export-privacy">
        <ShieldCheck size={14} />
        {t("Made on your device. Kept off the cloud.")}
      </div>
    </Modal>
  );
}
