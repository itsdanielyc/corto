import { useT } from "../i18n/locale";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Download,
  FolderOpen,
  LoaderCircle,
  MessageCircle,
  Save,
  Smartphone,
  Tv,
} from "lucide-react";
import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
} from "../../contracts/platform";
import { parseProject, type Project } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import type { MediaResources } from "../hooks/use-resources";
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
const PRESET_ICONS = {
  tv: Tv,
  phone: Smartphone,
  small: MessageCircle,
} as const;
/** Bits per second budgeted for the soundtrack in size estimates. */
const AUDIO_BITS = 192000;
type RenderMovie = CortoPlatform["renderMovie"];

/** Approximate encoded size for a duration and settings; labelled as an estimate in the UI. */
function estimateBytes(
  seconds: number,
  format: Project["output"]["format"],
  resolution: Project["output"]["resolution"],
  quality: number,
  preset?: keyof typeof EXPORT_PRESETS,
) {
  if (format === "wav") return seconds * 48000 * 2 * 2;
  if (format === "m4a") return (seconds * AUDIO_BITS) / 8;
  const videoBits =
    exportBitrate({ resolution, preset }) *
    (resolution === "2160p" ? 4 : 1) *
    (0.35 + quality / 100);
  return (seconds * (videoBits + AUDIO_BITS)) / 8;
}
const megabytes = (bytes: number) => (bytes / 1000000).toFixed(1);

/** The film as it opens: the first scene's picture, or its title card. */
function FilmPoster({
  project,
  resources,
}: {
  project: Project;
  resources: MediaResources;
}) {
  const first = project.scenes[0];
  const poster = first?.assetId ? resources[first.assetId]?.poster : undefined;
  return (
    <span
      className="film-poster"
      style={
        {
          aspectRatio: (() => {
            const size = frameDimensions(project.ratio, "720p");
            return `${size.width} / ${size.height}`;
          })(),
          background: first && !first.assetId ? first.background : undefined,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {poster ? (
        <img src={poster} alt="" draggable={false} />
      ) : (
        first?.caption && (
          <span className={`caption-${first.captionStyle}`}>
            {first.caption}
          </span>
        )
      )}
    </span>
  );
}

/** Export choices create immutable requests; the application queue owns jobs after the dialog closes. */
export function ExportDialog({
  project,
  platform,
  resources = {},
  onClose,
  renderMovie,
  time = 0,
  selectedIds = new Set<string>(),
}: {
  project: Project;
  platform: CortoPlatform;
  resources?: MediaResources;
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
  const estimatedBytes = estimateBytes(
    seconds,
    settings.format,
    resolution,
    settings.quality,
    preset,
  );
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
      title={t(result ? "Your film is ready" : "Export")}
      onClose={close}
      className={`export-dialog ${result ? "premiere-dialog" : ""}`}
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
        <div className="premiere">
          <div className="premiere-frame">
            <FilmPoster project={project} resources={resources} />
          </div>
          <h3 className="premiere-name">{project.name}</h3>
          <p className="premiere-meta">
            <span>{result.fileName}</span>
            <span>
              {result.location === "file" ? t("Saved") : t("Download started")}
            </span>
          </p>
          <div className="premiere-actions">
            {result.location === "file" && (
              <button
                className="button secondary"
                onClick={() => {
                  void platform
                    .revealExport()
                    .catch((failure) => setError(String(failure)));
                }}
              >
                <FolderOpen size={16} aria-hidden="true" />
                {t("Show in folder")}
              </button>
            )}
            <button className="button primary" onClick={onClose} autoFocus>
              {t("Back to my film")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="export-summary">
            <FilmPoster project={project} resources={resources} />
            <div>
              <strong>{project.name}</strong>
              <span>
                {project.scenes.length === 1
                  ? t("1 scene")
                  : `${project.scenes.length}${t(" scenes")}`}
                {t(" · ")}
                {formatTime(total)}
                {t(" · ")}
                {RATIO_LABELS[project.ratio]}
              </span>
            </div>
            <span className="badge format-badge">
              {format ?? t("Unavailable")}
            </span>
          </div>
          <fieldset className="export-options" disabled={!!progress}>
            <legend>{t("Where will it be watched?")}</legend>
            <div className="preset-grid">
              {(["tv", "phone", "small"] as const).map((id) => {
                const option = EXPORT_PRESETS[id];
                const Icon = PRESET_ICONS[id];
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
                    <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                    <strong>{t(option.title)}</strong>
                    <span>{t(option.subtitle)}</span>
                    <small>
                      {option.resolution}
                      {settings.format === "mp4" &&
                        ` · ~${megabytes(estimateBytes(seconds, "mp4", presetResolution(id), id === "small" ? 50 : 70, id))} MB`}
                    </small>
                  </label>
                );
              })}
            </div>
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
                {t(" × ")}
                {dimensions.height}
                {t(" · ")}
                {settings.fps === "source"
                  ? t("source frame rate")
                  : `${settings.fps} fps`}
                {t(" · ")}
              </>
            )}
            {settings.format === "mp4"
              ? t("H.264 video, AAC sound")
              : settings.format === "gif"
                ? t("Animated GIF · up to 960 pixels, 15 fps")
                : settings.format === "wav"
                  ? t("Uncompressed PCM audio")
                  : t("AAC audio")}
            <br />
            {t("Estimated size: about ")}
            {megabytes(estimatedBytes)}
            {t(" MB")}
            {settings.format === "gif" &&
              t(" (GIF sizes vary a lot with movement)")}
          </p>
          {!format && (
            <div className="export-fallback">
              <p className="inline-error">
                {t(
                  "This browser cannot export MP4. Open the film in Corto for desktop: save a portable copy to take your media and edits with you.",
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
                <Save size={15} aria-hidden="true" />
                {t("Save portable project")}
              </button>
            </div>
          )}
          {progress ? (
            <div className="export-progress">
              <div className="export-progress-label">
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
                <span>{t(progress.message)}</span>
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
              <div className="modal-actions">
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
            <div className="export-actions">
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
                <Download size={16} aria-hidden="true" />
                {t("Export ")}
                {format ?? t("movie")}
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
    </Modal>
  );
}
