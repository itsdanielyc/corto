import { useT } from "../i18n/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { MediaAsset, Project } from "../../contracts/project";
import {
  buildSlideshow,
  buildProjectTemplate,
  projectTemplateCaptions,
  slideshowPhotoSeconds,
  sortMedia,
  THEMES,
  type SlideshowOptions,
} from "../domain/slideshow";
import type { CortoPlatform } from "../platform/types";
import { Choice, Numeric, Toggle, ToolSection } from "./tools/Fields";
import { Modal } from "./primitives";
import { soundAnalysis } from "../media/sound-analysis";
import { bundledSoundFile } from "../media/bundled-sounds";
import { inspectFile } from "../media/import";
import { importMedia } from "../media/phone";
import { addAsset } from "../domain/project";
import type { MediaResources } from "../hooks/use-resources";
import { useDraftRequest } from "../hooks/use-draft-request";
/** Below this many seconds per photo a slideshow starts to feel rushed. */
const QUICK_PHOTO_SECONDS = 2.5;

/** Read the actual bundled recording once for both the duration preview and the draft. */
function useThemeSoundtrack(id: string | null) {
  const [track, setTrack] = useState<{
    id: string;
    file: File;
    asset: MediaAsset;
  } | null>(null);
  const [failure, setFailure] = useState<{
    id: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const load = async () => {
      const file = await bundledSoundFile(id, controller.signal);
      const { asset } = await inspectFile(file);
      if (!controller.signal.aborted) setTrack({ id, file, asset });
    };
    setFailure(null);
    void load().catch((error: unknown) => {
      if (!controller.signal.aborted)
        setFailure({
          id,
          message: error instanceof Error ? error.message : String(error),
        });
    });
    return () => controller.abort();
  }, [id]);
  return {
    track: track?.id === id ? track : null,
    error: failure?.id === id ? failure.message : null,
  };
}
export function SlideshowDialog({
  project,
  platform,
  resources = {},
  onCreate,
  onClose,
}: {
  project: Project;
  platform: CortoPlatform;
  resources?: MediaResources;
  onCreate: (project: Project) => void;
  onClose: () => void;
}) {
  const t = useT();
  // Photos chosen here, for a slideshow started from Films or with more
  // moments than the open film holds. They join the new film only.
  const [chosen, setChosen] = useState<
    { asset: MediaAsset; original?: MediaAsset; poster: string | null }[]
  >([]);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const media = [
    ...Object.values(project.assets).filter(
      (asset) =>
        ["image", "video"].includes(asset.kind) &&
        !asset.isOriginalOnly &&
        !asset.isProxy,
    ),
    ...chosen.map((entry) => entry.asset),
  ];
  const posterOf = (id: string) =>
    resources[id]?.poster ??
    chosen.find((entry) => entry.asset.id === id)?.poster ??
    null;
  // Posters live as long as the dialog; revoke them when it closes.
  const posters = useRef<string[]>([]);
  useEffect(
    () => () => posters.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  const [selected, setSelected] = useState(
    new Set(media.map((asset) => asset.id)),
  );
  const addFiles = async (files: File[]) => {
    setImporting(true);
    setError(null);
    const added: typeof chosen = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        const { asset, original } = await importMedia(file, platform);
        if (asset.kind !== "image" && asset.kind !== "video") continue;
        const poster =
          asset.kind === "image" ? URL.createObjectURL(file) : null;
        if (poster) posters.current.push(poster);
        added.push({ asset, original, poster });
      } catch (failure) {
        failures.push(
          `${file.name}: ${failure instanceof Error ? failure.message : String(failure)}`,
        );
      }
    }
    setChosen((previous) => [...previous, ...added]);
    setSelected((previous) => {
      const next = new Set(previous);
      added.forEach((entry) => next.add(entry.asset.id));
      return next;
    });
    if (failures.length) setError(failures.join("\n"));
    setImporting(false);
  };
  const [theme, setTheme] = useState<SlideshowOptions["theme"]>("family");
  const [order, setOrder] = useState<SlideshowOptions["order"]>("date");
  const [seconds, setSeconds] = useState(project.defaults.photoSeconds);
  const [motion, setMotion] = useState(true);
  const [dates, setDates] = useState(false);
  const [fit, setFit] = useState(false);
  const [beats, setBeats] = useState(false);
  const [template, setTemplate] = useState(false);
  const [musicId, setMusicId] = useState(
    project.audioClips.find((clip) => clip.role === "music")?.assetId ?? "",
  );
  const [title, setTitle] = useState("");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const song = project.audioClips.find(
    (clip) => clip.role === "music" && clip.assetId === musicId,
  );
  const themeMusic = useThemeSoundtrack(
    musicId === "theme" ? THEMES[theme].music : null,
  );
  const music =
    musicId === "theme" ? themeMusic.track?.asset : project.assets[musicId];
  const musicOffset = song?.offset ?? 0;
  const moments = useMemo(
    () =>
      sortMedia(
        Array.from(
          selected,
          (id) =>
            project.assets[id] ??
            chosen.find((entry) => entry.asset.id === id)?.asset,
        ).filter((asset) => !!asset),
        order,
      ),
    [selected, project.assets, chosen, order],
  );
  const photoCount = moments.filter((asset) => asset.kind === "image").length;
  const fitSeconds =
    fit && photoCount > 0 && music ? music.duration - musicOffset : undefined;
  const timing = useMemo(() => {
    try {
      return {
        seconds: slideshowPhotoSeconds(moments, {
          theme,
          title,
          seconds,
          fitSeconds,
        }),
        error: null,
      };
    } catch (failure) {
      return {
        seconds: null,
        error: failure instanceof Error ? failure.message : String(failure),
      };
    }
  }, [moments, theme, title, seconds, fitSeconds]);
  const beginDraft = useDraftRequest();
  const create = async () => {
    if (musicId === "theme" && !themeMusic.track) return;
    const signal = beginDraft();
    setBusy(true);
    setError(null);
    try {
      let source = project;
      for (const entry of chosen) {
        if (entry.original) source = addAsset(source, entry.original);
        source = addAsset(source, entry.asset);
      }
      if (themeMusic.track) {
        const { asset, file } = themeMusic.track;
        await platform.putAsset(asset, file);
        signal.throwIfAborted();
        source = addAsset(source, asset);
      }
      const analysis =
        beats && music && !template
          ? await soundAnalysis(platform, source, music)
          : null;
      signal.throwIfAborted();
      const draft = template
        ? buildProjectTemplate(
            { ...source, id: crypto.randomUUID() },
            theme,
            title,
            music?.id ?? null,
          )
        : buildSlideshow(
            { ...source, id: crypto.randomUUID() },
            {
              assetIds: [...selected],
              theme,
              order,
              seconds,
              motion,
              dateCaptions: dates,
              title,
              fitSeconds,
              beats: analysis?.beats
                .filter((beat) => beat >= musicOffset)
                .map((beat) => beat - musicOffset),
              musicAssetId: music?.id ?? null,
              musicOffset,
            },
          );
      if (!title.trim()) draft.name = t(THEMES[theme].name);
      if (template)
        draft.scenes = draft.scenes.map((scene, index) =>
          index === 0 && title.trim()
            ? scene
            : { ...scene, caption: t(scene.caption) },
        );
      if (project.scenes.length || Object.keys(project.assets).length)
        await platform.saveProject(project);
      signal.throwIfAborted();
      onCreate(draft);
      onClose();
    } catch (failure) {
      if (signal.aborted) return;
      setError(
        failure instanceof Error
          ? failure.message
          : "The slideshow could not be created",
      );
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };
  const steps = ["Photos", "Mood", "Music"] as const;
  const last = step === steps.length - 1;
  const readingTrack = musicId === "theme" && !themeMusic.track;
  const perPhoto = readingTrack && fit ? null : timing.seconds;
  const message =
    error || themeMusic.error || (!template && last ? timing.error : null);
  return (
    <Modal
      title={t("Make a slideshow")}
      onClose={onClose}
      className="slideshow-dialog"
    >
      <ol className="step-list" aria-label={t("Slideshow steps")}>
        {steps.map((name, index) => (
          <li key={name}>
            <button
              type="button"
              aria-current={step === index ? "step" : undefined}
              data-done={index < step}
              onClick={() => setStep(index)}
            >
              <span className="step-number">{index + 1}</span>
              {t(name)}
            </button>
          </li>
        ))}
      </ol>
      <div className="slideshow-step" key={step}>
        {step === 0 && (
          <>
            <Toggle
              label={t("Use a project template")}
              checked={template}
              onChange={setTemplate}
            />
            {template ? (
              <ToolSection title={t("Project template")}>
                <ol className="template-captions">
                  {projectTemplateCaptions(theme).map((caption) => (
                    <li key={caption}>{t(caption)}</li>
                  ))}
                </ol>
                <p className="dialog-note">
                  {t(
                    "Add photos after each title, then remove any titles you do not need.",
                  )}
                </p>
              </ToolSection>
            ) : (
              <ToolSection title={t("Your moments")}>
                <div className="slideshow-selection-bar">
                  <span>
                    {selected.size}
                    {t(" of ")}
                    {media.length}
                    {t(" chosen")}
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      setSelected(new Set(media.map((asset) => asset.id)))
                    }
                  >
                    {t("Select all")}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setSelected(new Set())}
                  >
                    {t("Clear selection")}
                  </button>
                </div>
                <div className="slideshow-media">
                  {media.map((asset) => (
                    <label
                      key={asset.id}
                      className={selected.has(asset.id) ? "chosen" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(asset.id)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.target.checked) next.add(asset.id);
                          else next.delete(asset.id);
                          setSelected(next);
                        }}
                      />
                      <span className="slideshow-thumb">
                        {posterOf(asset.id) ? (
                          <img src={posterOf(asset.id) ?? undefined} alt="" />
                        ) : null}
                      </span>
                      <span className="slideshow-name">{asset.name}</span>
                      <small>
                        {asset.capturedAt
                          ? new Date(asset.capturedAt).getUTCFullYear()
                          : t(asset.kind === "video" ? "Video" : "Photo")}
                      </small>
                    </label>
                  ))}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  hidden
                  accept=".jpg,.jpeg,.png,.webp,.bmp,.heic,.heif,.gif,.tif,.tiff,.mp4,.mov,.m4v,.webm"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length) void addFiles(files);
                  }}
                />
                <button
                  className={
                    media.length
                      ? "button secondary slideshow-add"
                      : "button primary large slideshow-add"
                  }
                  disabled={importing}
                  onClick={() => fileInput.current?.click()}
                >
                  <ImagePlus size={16} aria-hidden="true" />
                  {importing
                    ? t("Adding your photos…")
                    : media.length
                      ? t("Add more photos and clips")
                      : t("Choose photos and clips")}
                </button>
                <Choice
                  label={t("Slideshow order")}
                  value={order}
                  options={[
                    ["date", "Date taken"],
                    ["name", "Filename"],
                    ["selection", "Selection order"],
                  ]}
                  onChange={setOrder}
                />
                <p className="dialog-note">
                  {t(
                    "Dates come from the photo, then the file date, then the name.",
                  )}
                </p>
              </ToolSection>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <div
              className="theme-tiles"
              role="radiogroup"
              aria-label={t("Slideshow theme")}
            >
              {(
                Object.entries(THEMES) as [
                  SlideshowOptions["theme"],
                  (typeof THEMES)[SlideshowOptions["theme"]],
                ][]
              ).map(([id, value]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={theme === id}
                  className="theme-tile"
                  onClick={() => setTheme(id)}
                >
                  <span
                    aria-hidden="true"
                    className={`theme-art caption-${value.style}`}
                    style={{ background: value.background }}
                    data-light={value.background === "#e8e5dd"}
                  >
                    {title.trim() || t(value.name)}
                  </span>
                  {t(value.name)}
                </button>
              ))}
            </div>
            <label className="field-label">
              {t("Opening title (optional)")}
              <input
                aria-label={t("Slideshow opening title")}
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            {!template && (
              <div className="tool-fields">
                <Numeric
                  label={t("Seconds per photo")}
                  value={seconds}
                  min={0.25}
                  max={120}
                  onChange={setSeconds}
                />
                <Toggle
                  label={t("Gentle pan and zoom")}
                  checked={motion}
                  onChange={setMotion}
                />
                <Toggle
                  label={t("Caption photos with capture dates")}
                  checked={dates}
                  onChange={setDates}
                />
              </div>
            )}
          </>
        )}
        {step === 2 && (
          <div className="tool-fields">
            <Choice
              label={t("Slideshow soundtrack")}
              value={musicId}
              translateOptions={false}
              options={[
                ["", t("No music")],
                ["theme", t("The theme's music")],
                ...Object.values(project.assets)
                  .filter(
                    (asset) => asset.kind === "audio" && !asset.isOriginalOnly,
                  )
                  .map((asset) => [asset.id, asset.name] as const),
              ]}
              onChange={setMusicId}
            />
            {musicId && !template && photoCount > 0 && (
              <>
                <Toggle
                  label={t("Fit photos to the soundtrack")}
                  checked={fit}
                  onChange={setFit}
                />
                <Toggle
                  label={t("Align photo changes to music beats")}
                  checked={beats}
                  onChange={setBeats}
                />
              </>
            )}
            {!template && photoCount > 0 && perPhoto !== null && (
              <p className="slideshow-summary">
                {photoCount}
                {t(photoCount === 1 ? " photo" : " photos")}
                {t(" · about ")}
                {Number(perPhoto.toFixed(1))}
                {t(" s each")}
              </p>
            )}
            {!template &&
              photoCount > 0 &&
              perPhoto !== null &&
              perPhoto < QUICK_PHOTO_SECONDS && (
                <p className="inline-error slideshow-warning">
                  {t(
                    "That is quick for a slideshow. Choose fewer photos, or a longer song.",
                  )}
                </p>
              )}
          </div>
        )}
      </div>
      {message && (
        <p role="alert" className="inline-error">
          {t(message)}
        </p>
      )}
      <div className="modal-actions">
        {step > 0 ? (
          <button
            className="button secondary"
            onClick={() => setStep(step - 1)}
          >
            {t("Back")}
          </button>
        ) : (
          <button className="button secondary" onClick={onClose}>
            {t("Cancel")}
          </button>
        )}
        {last ? (
          <button
            className="button primary"
            disabled={
              (!template && (!selected.size || !!timing.error)) ||
              readingTrack ||
              busy
            }
            onClick={() => {
              void create();
            }}
          >
            {busy ? t("Creating draft…") : t("Create editable draft")}
          </button>
        ) : (
          <button
            className="button primary"
            // With no photos yet, choosing them is the one thing to do.
            disabled={step === 0 && !template && !media.length}
            onClick={() => setStep(step + 1)}
          >
            {t("Next")}
          </button>
        )}
      </div>
    </Modal>
  );
}
