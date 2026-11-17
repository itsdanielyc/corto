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
export function SlideshowDialog({
  project,
  platform,
  onCreate,
  onClose,
}: {
  project: Project;
  platform: CortoPlatform;
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
      const analysis =
        beats && music && !template
          ? await soundAnalysis(platform, project, music)
          : null;
      const draft = template
        ? buildProjectTemplate(
            { ...project, id: crypto.randomUUID() },
            theme,
            title,
            musicId || null,
          )
        : buildSlideshow(
            { ...project, id: crypto.randomUUID() },
            {
              assetIds: [...selected],
              theme,
              order,
              seconds,
              motion,
              dateCaptions: dates,
              title,
              fitSeconds:
                fit && music ? music.duration - musicOffset : undefined,
              beats: analysis?.beats
                .filter((beat) => beat >= musicOffset)
                .map((beat) => beat - musicOffset),
              musicAssetId: musicId || null,
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
  return (
    <Modal
      title={t("Make a slideshow")}
      onClose={onClose}
      className="slideshow-dialog"
    >
      <p className="modal-introduction">
        {t("Choose your moments and a mood. Every scene stays editable.")}
      </p>
      <Toggle
        label={t("Use a project template")}
        checked={template}
        onChange={setTemplate}
      />
      <div className="slideshow-layout">
        {template ? (
          <ToolSection title={t("Project template")}>
            <ol>
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
            <div className="tool-button-row">
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
                <label key={asset.id}>
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
                  <span>{asset.name}</span>
                  <small>
                    {asset.capturedAt
                      ? new Date(asset.capturedAt).getUTCFullYear()
                      : asset.kind}
                  </small>
                </label>
              ))}
            </div>
            {!media.length && (
              <p>
                {t("Import photos, clips or a folder in the editor first.")}
              </p>
            )}
          </ToolSection>
        )}
        <ToolSection title={t("Set the feeling")}>
          <label className="field-label">
            {t("Opening title (optional)")}
            <input
              aria-label={t("Slideshow opening title")}
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <Choice
            label={t("Slideshow theme")}
            value={theme}
            options={Object.entries(THEMES).map(([id, value]) => [
              id as SlideshowOptions["theme"],
              value.name,
            ])}
            onChange={setTheme}
          />
          <Choice
            label={t("Slideshow soundtrack")}
            value={musicId}
            translateOptions={false}
            options={[
              ["", t("No music")],
              ...Object.values(project.assets)
                .filter(
                  (asset) => asset.kind === "audio" && !asset.isOriginalOnly,
                )
                .map((asset) => [asset.id, asset.name] as const),
            ]}
            onChange={setMusicId}
          />
          {!template && (
            <>
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
            </>
          )}
          {music && !template && (
            <Toggle
              label={t("Fit photos to the soundtrack")}
              checked={fit}
              onChange={setFit}
            />
          )}
          {music && !template && (
            <Toggle
              label={t("Align photo changes to music beats")}
              checked={beats}
              onChange={setBeats}
            />
          )}
          <p className="dialog-note">
            {t(
              "Dates come from local EXIF when available, then file dates and names. The original film stays in My films.",
            )}
          </p>
        </ToolSection>
      </div>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="button primary"
          disabled={(!template && !selected.size) || busy}
          onClick={() => {
            void create();
          }}
        >
          {busy ? t("Creating draft…") : t("Create editable draft")}
        </button>
      </div>
    </Modal>
  );
}
