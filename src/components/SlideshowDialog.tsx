import { useState } from "react";
import type { Project } from "../../contracts/project";
import {
  buildSlideshow,
  THEMES,
  type SlideshowOptions,
} from "../domain/slideshow";
import type { CortoPlatform } from "../platform/types";
import { Choice, Numeric, Toggle, ToolSection } from "./tools/Fields";
import { Modal } from "./primitives";

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
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const song = project.audioClips.find((clip) => clip.role === "music");
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const draft = buildSlideshow(
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
            fit && song
              ? project.assets[song.assetId].duration - song.offset
              : undefined,
        },
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
      title="Make a slideshow"
      onClose={onClose}
      className="slideshow-dialog"
    >
      <p className="modal-introduction">
        Choose your moments and a mood. Every scene stays editable.
      </p>
      <div className="slideshow-layout">
        <ToolSection title="Your moments">
          <div className="tool-button-row">
            <button
              className="text-button"
              onClick={() =>
                setSelected(new Set(media.map((asset) => asset.id)))
              }
            >
              Select all
            </button>
            <button
              className="text-button"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
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
            <p>Import photos, clips or a folder in the editor first.</p>
          )}
        </ToolSection>
        <ToolSection title="Set the feeling">
          <label className="field-label">
            Opening title (optional)
            <input
              aria-label="Slideshow opening title"
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <Choice
            label="Slideshow theme"
            value={theme}
            options={Object.entries(THEMES).map(([id, value]) => [
              id as SlideshowOptions["theme"],
              value.name,
            ])}
            onChange={setTheme}
          />
          <Choice
            label="Slideshow order"
            value={order}
            options={[
              ["date", "Date taken"],
              ["name", "Filename"],
              ["selection", "Selection order"],
            ]}
            onChange={setOrder}
          />
          <Numeric
            label="Seconds per photo"
            value={seconds}
            min={0.25}
            max={120}
            onChange={setSeconds}
          />
          <Toggle
            label="Gentle pan and zoom"
            checked={motion}
            onChange={setMotion}
          />
          <Toggle
            label="Caption photos with capture dates"
            checked={dates}
            onChange={setDates}
          />
          {song && (
            <Toggle
              label="Fit photos to the soundtrack"
              checked={fit}
              onChange={setFit}
            />
          )}
          <p className="dialog-note">
            Dates come from local EXIF when available, then file dates and
            names. The original film stays in My films.
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
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!selected.size || busy}
          onClick={() => {
            void create();
          }}
        >
          {busy ? "Creating draft…" : "Create editable draft"}
        </button>
      </div>
    </Modal>
  );
}
