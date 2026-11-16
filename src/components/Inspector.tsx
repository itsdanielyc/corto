import { memo, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Crop,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Type,
} from "lucide-react";
import { LIMITS, type MediaAsset, type Scene } from "../../contracts/project";
import { IconButton } from "./primitives";

interface InspectorProperties {
  scene: Scene | null;
  asset: MediaAsset | null;
  index: number;
  count: number;
  onChange: (changes: Partial<Scene>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onMove: (direction: number) => void;
  busy: boolean;
}

function NumberField({
  value,
  label,
  minimum,
  maximum,
  onCommit,
}: {
  value: number;
  label: string;
  minimum: number;
  maximum: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  useEffect(() => setDraft(String(Number(value.toFixed(3)))), [value]);
  return (
    <label className="field-label">
      {label}
      <div className="number-wrap">
        <input
          aria-label={label}
          type="number"
          min={minimum}
          max={maximum}
          step="0.25"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft.trim()) onCommit(Number(draft));
            setDraft(String(Number(value.toFixed(3))));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span>sec</span>
      </div>
    </label>
  );
}

export const Inspector = memo(function Inspector({
  scene,
  asset,
  index,
  count,
  onChange,
  onDelete,
  onDuplicate,
  onSplit,
  onMove,
  busy,
}: InspectorProperties) {
  return (
    <aside
      className="inspector"
      aria-label="Scene settings"
      data-geo="inspector"
    >
      {scene ? (
        <>
          <div className="inspector-heading">
            <div>
              <span className="eyebrow">
                SCENE {String(index + 1).padStart(2, "0")}
              </span>
              <h2>
                {asset?.kind === "video"
                  ? "A little motion."
                  : asset
                    ? "The moment."
                    : "The words."}
              </h2>
            </div>
            <SlidersHorizontal size={17} />
          </div>
          <div className="scene-actions">
            <IconButton
              icon={ArrowLeft}
              label="Move scene left"
              disabled={busy || index === 0}
              onClick={() => onMove(-1)}
            />
            <IconButton
              icon={ArrowRight}
              label="Move scene right"
              disabled={busy || index === count - 1}
              onClick={() => onMove(1)}
            />
            <span />
            <IconButton
              icon={Copy}
              label="Duplicate scene"
              disabled={busy}
              onClick={onDuplicate}
            />
            <IconButton
              icon={Trash2}
              label="Delete scene"
              disabled={busy}
              onClick={onDelete}
            />
          </div>
          <section className="inspector-section">
            <h3>Timing</h3>
            {asset?.kind === "video" && (
              <NumberField
                value={scene.start}
                label="Start in source (seconds)"
                minimum={0}
                maximum={Math.max(
                  0,
                  asset.duration - LIMITS.minimumSceneSeconds,
                )}
                onCommit={(start) =>
                  onChange({
                    start,
                    duration: Math.min(scene.duration, asset.duration - start),
                  })
                }
              />
            )}
            <NumberField
              value={scene.duration}
              label="Duration (seconds)"
              minimum={LIMITS.minimumSceneSeconds}
              maximum={
                asset?.kind === "video"
                  ? Math.min(LIMITS.sceneSeconds, asset.duration - scene.start)
                  : LIMITS.sceneSeconds
              }
              onCommit={(duration) => onChange({ duration })}
            />
            <button
              className="text-button split-button"
              onClick={onSplit}
              disabled={busy || scene.duration < LIMITS.minimumSceneSeconds * 2}
              title="Split at the playhead, or in the middle when the playhead is outside this scene"
            >
              <Scissors size={14} />
              Split scene
            </button>
          </section>
          <section className="inspector-section">
            <h3>
              <Type size={14} />
              Say something
            </h3>
            <label className="field-label">
              On-screen title
              <textarea
                aria-label="On-screen title"
                placeholder="A place. A feeling. A few words."
                maxLength={LIMITS.captionCharacters}
                value={scene.caption}
                onChange={(event) => onChange({ caption: event.target.value })}
                rows={3}
              />
            </label>
            <div className="type-styles" role="group" aria-label="Title style">
              {(["classic", "modern", "minimal"] as const).map((style) => (
                <button
                  key={style}
                  aria-label={`${style[0].toUpperCase()}${style.slice(1)} title style`}
                  aria-pressed={scene.captionStyle === style}
                  className={`type-style ${style}`}
                  onClick={() => onChange({ captionStyle: style })}
                >
                  <span>Aa</span>
                  <small>{style}</small>
                </button>
              ))}
            </div>
            <label className="field-label inline-field">
              Position
              <select
                aria-label="Title position"
                value={scene.captionPosition}
                onChange={(event) =>
                  onChange({
                    captionPosition: event.target
                      .value as Scene["captionPosition"],
                  })
                }
              >
                <option value="center">Centre</option>
                <option value="bottom">Lower third</option>
              </select>
            </label>
          </section>
          <section className="inspector-section">
            <h3>
              <Crop size={14} />
              Picture & pace
            </h3>
            {asset && (
              <div
                className="segmented"
                role="group"
                aria-label="Picture framing"
              >
                <button
                  aria-pressed={scene.fit === "cover"}
                  onClick={() => onChange({ fit: "cover" })}
                >
                  Fill frame
                </button>
                <button
                  aria-pressed={scene.fit === "contain"}
                  onClick={() => onChange({ fit: "contain" })}
                >
                  Fit whole image
                </button>
              </div>
            )}
            {!asset && (
              <div
                className="background-swatches"
                role="group"
                aria-label="Title background"
              >
                {[
                  { value: "#151517", name: "Graphite" },
                  { value: "#e8e5dd", name: "Paper" },
                  { value: "#ffffff", name: "White" },
                ].map((colour) => (
                  <button
                    key={colour.value}
                    style={{ background: colour.value }}
                    aria-label={`${colour.name} background`}
                    aria-pressed={scene.background === colour.value}
                    onClick={() => onChange({ background: colour.value })}
                  />
                ))}
              </div>
            )}
            <label className="field-label inline-field">
              Transition
              <select
                aria-label="Scene transition"
                value={scene.transition}
                onChange={(event) =>
                  onChange({
                    transition: event.target.value as Scene["transition"],
                  })
                }
              >
                <option value="cut">Straight cut</option>
                <option value="fade">Fade through black</option>
              </select>
            </label>
          </section>
          {asset?.kind === "video" && (
            <section className="inspector-section">
              <h3>Original sound</h3>
              <label className="range-label">
                Clip volume<span>{Math.round(scene.volume * 100)}%</span>
                <input
                  aria-label="Clip volume"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(scene.volume * 100)}
                  onChange={(event) =>
                    onChange({ volume: Number(event.target.value) / 100 })
                  }
                />
              </label>
            </section>
          )}
          <div className="inspector-note">
            Your originals stay just as they are.
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <SlidersHorizontal size={28} strokeWidth={1.3} />
          <h2>Make it your own.</h2>
          <p>
            Select a scene to change its timing, add a title, or find the right
            frame.
          </p>
          <span>A small edit can say a lot.</span>
        </div>
      )}
    </aside>
  );
});
