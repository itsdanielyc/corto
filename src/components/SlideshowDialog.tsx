import { useT } from "../i18n/locale";
import { useState } from "react";
import type { Project } from "../../contracts/project";
import {
  buildSlideshow,
  buildProjectTemplate,
  projectTemplateCaptions,
  THEMES,
  type SlideshowOptions,
} from "../domain/slideshow";
import type { CortoPlatform } from "../platform/types";
import { Choice, Numeric, Toggle, ToolSection } from "./tools/Fields";
import { Modal } from "./primitives";
import { soundAnalysis } from "../media/sound-analysis";
import { bundledSoundFile } from "../media/bundled-sounds";
import { inspectFile } from "../media/import";
import { addAsset } from "../domain/project";
import type { MediaResources } from "../hooks/use-resources";
/** Below this many seconds per photo a slideshow starts to feel rushed. */
const QUICK_PHOTO_SECONDS = 2.5;
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
  const media = Object.values(project.assets).filter(
    (asset) =>
      ["image", "video"].includes(asset.kind) &&
      !asset.isOriginalOnly &&
      !asset.isProxy,
  );
  const [selected, setSelected] = useState(
    new Set(media.map((asset) => asset.id)),
  );
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
  const music = musicId ? project.assets[musicId] : null;
  const musicOffset = song?.offset ?? 0;
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      let source = project;
      let selectedMusic = music;
      if (musicId === "theme") {
        const file = await bundledSoundFile(THEMES[theme].music);
        const { asset } = await inspectFile(file);
        await platform.putAsset(asset, file);
        source = addAsset(source, asset);
        selectedMusic = asset;
      }
      const analysis =
        beats && selectedMusic && !template
          ? await soundAnalysis(platform, source, selectedMusic)
          : null;
      const draft = template
        ? buildProjectTemplate(
            { ...source, id: crypto.randomUUID() },
            theme,
            title,
            selectedMusic?.id ?? null,
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
              fitSeconds:
                fit && selectedMusic
                  ? selectedMusic.duration - musicOffset
                  : undefined,
              beats: analysis?.beats
                .filter((beat) => beat >= musicOffset)
                .map((beat) => beat - musicOffset),
              musicAssetId: selectedMusic?.id ?? null,
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
      onCreate(draft);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The slideshow could not be created",
      );
    } finally {
      setBusy(false);
    }
  };
  const steps = ["Photos", "Mood", "Music"] as const;
  const last = step === steps.length - 1;
  const soundtrack = musicId === "theme" ? null : music;
  const photoCount = template ? 0 : selected.size;
  const perPhoto =
    fit && soundtrack && photoCount
      ? (soundtrack.duration - musicOffset) / photoCount
      : seconds;
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
                        {resources[asset.id]?.poster ? (
                          <img
                            src={resources[asset.id]?.poster ?? undefined}
                            alt=""
                          />
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
                {!media.length && (
                  <p className="dialog-note">
                    {t("Import photos, clips or a folder in the editor first.")}
                  </p>
                )}
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
                ["theme", t("Theme soundtrack · original CC0 music")],
                ...Object.values(project.assets)
                  .filter(
                    (asset) => asset.kind === "audio" && !asset.isOriginalOnly,
                  )
                  .map((asset) => [asset.id, asset.name] as const),
              ]}
              onChange={setMusicId}
            />
            {(music || musicId === "theme") && !template && (
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
            {!template && photoCount > 0 && (
              <p className="slideshow-summary">
                {photoCount}
                {t(photoCount === 1 ? " photo" : " photos")}
                {t(" · about ")}
                {Number(perPhoto.toFixed(1))}
                {t(" s each")}
              </p>
            )}
            {!template && photoCount > 0 && perPhoto < QUICK_PHOTO_SECONDS && (
              <p className="inline-error slideshow-warning">
                {t(
                  "That is quick for a slideshow. Choose fewer photos, or a longer song.",
                )}
              </p>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
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
            disabled={(!template && !selected.size) || busy}
            onClick={() => {
              void create();
            }}
          >
            {busy ? t("Creating draft…") : t("Create editable draft")}
          </button>
        ) : (
          <button className="button primary" onClick={() => setStep(step + 1)}>
            {t("Next")}
          </button>
        )}
      </div>
    </Modal>
  );
}
