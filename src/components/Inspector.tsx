import { useT } from "../i18n/locale";
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
  onTools: () => void;
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
  const t = useT();
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  useEffect(() => setDraft(String(Number(value.toFixed(3)))), [value]);
  return (
    <label className="field-label">
      {label}
      <div className="number-wrap">
        <input
          aria-label={t(label)}
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
        <span>{t("sec")}</span>
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
  onTools,
}: InspectorProperties) {
  const t = useT();
  return (
    <aside
      className="inspector"
      aria-label={t("Scene settings")}
      data-geo="inspector"
    >
      {scene ? (
        <>
          <div className="inspector-heading">
            <div>
              <span className="eyebrow">
                {t("SCENE ")}
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2>
                {asset?.kind === "video"
                  ? t("A little motion.")
                  : asset
                    ? t("The moment.")
                    : t("The words.")}
              </h2>
            </div>
            <SlidersHorizontal size={17} />
          </div>
          <div className="scene-actions">
            <IconButton
              icon={ArrowLeft}
              label={t("Move scene left")}
              disabled={busy || index === 0}
              onClick={() => onMove(-1)}
            />
            <IconButton
              icon={ArrowRight}
              label={t("Move scene right")}
              disabled={busy || index === count - 1}
              onClick={() => onMove(1)}
            />
            <span />
            <IconButton
              icon={Copy}
              label={t("Duplicate scene")}
              disabled={busy}
              onClick={onDuplicate}
            />
            <IconButton
              icon={Trash2}
              label={t("Delete scene")}
              disabled={busy}
              onClick={onDelete}
            />
          </div>
          <button
            className="button secondary scene-tools-button"
            onClick={onTools}
            disabled={busy}
          >
            {t("More scene tools")}
          </button>
          <section className="inspector-section">
            <h3>{t("Timing")}</h3>
            {asset?.kind === "video" && (
              <NumberField
                value={scene.start}
                label={t("Start in source (seconds)")}
                minimum={0}
                maximum={Math.max(
                  0,
                  asset.duration - LIMITS.minimumSceneSeconds * scene.speed,
                )}
                onCommit={(start) =>
                  onChange({
                    start,
                    duration: Math.min(
                      scene.duration,
                      (asset.duration - start) / scene.speed,
                    ),
                  })
                }
              />
            )}
            <NumberField
              value={scene.duration}
              label={t("Duration (seconds)")}
              minimum={LIMITS.minimumSceneSeconds}
              maximum={
                asset?.kind === "video" && !scene.loop
                  ? Math.min(
                      LIMITS.sceneSeconds,
                      (asset.duration - scene.start) / scene.speed,
                    )
                  : LIMITS.sceneSeconds
              }
              onCommit={(duration) => onChange({ duration })}
            />
            <button
              className="text-button split-button"
              onClick={onSplit}
              disabled={busy || scene.duration < LIMITS.minimumSceneSeconds * 2}
              title={t(
                "Split at the playhead, or in the middle when the playhead is outside this scene",
              )}
            >
              <Scissors size={14} />
              {t("Split scene")}
            </button>
          </section>
          <section className="inspector-section">
            <h3>
              <Type size={14} />
              {t("Say something")}
            </h3>
            <label className="field-label">
              {t("On-screen title")}
              <textarea
                aria-label={t("On-screen title")}
                placeholder={t("A place. A feeling. A few words.")}
                maxLength={LIMITS.captionCharacters}
                value={scene.caption}
                onChange={(event) => onChange({ caption: event.target.value })}
                rows={3}
              />
            </label>
            <div
              className="type-styles"
              role="group"
              aria-label={t("Title style")}
            >
              {(["classic", "modern", "minimal"] as const).map((style) => (
                <button
                  key={t(style)}
                  aria-label={t(
                    `${style[0].toUpperCase()}${style.slice(1)} title style`,
                  )}
                  aria-pressed={scene.captionStyle === style}
                  className={`type-style ${t(style)}`}
                  onClick={() => onChange({ captionStyle: style })}
                >
                  <span>{t("Aa")}</span>
                  <small>{t(style)}</small>
                </button>
              ))}
            </div>
            <label className="field-label inline-field">
              {t("Position")}
              <select
                aria-label={t("Title position")}
                value={scene.captionPosition}
                onChange={(event) =>
                  onChange({
                    captionPosition: event.target
                      .value as Scene["captionPosition"],
                  })
                }
              >
                <option value="center">{t("Centre")}</option>
                <option value="bottom">{t("Lower third")}</option>
              </select>
            </label>
          </section>
          <section className="inspector-section">
            <h3>
              <Crop size={14} />
              {t("Picture & pace")}
            </h3>
            {asset && (
              <div
                className="segmented"
                role="group"
                aria-label={t("Picture framing")}
              >
                <button
                  aria-pressed={scene.fit === "cover"}
                  onClick={() => onChange({ fit: "cover" })}
                >
                  {t("Fill frame")}
                </button>
                <button
                  aria-pressed={scene.fit === "contain"}
                  onClick={() => onChange({ fit: "contain" })}
                >
                  {t("Fit whole image")}
                </button>
              </div>
            )}
            {!asset && (
              <div
                className="background-swatches"
                role="group"
                aria-label={t("Title background")}
              >
                {[
                  { value: "#151517", name: "Graphite" },
                  { value: "#e8e5dd", name: "Paper" },
                  { value: "#ffffff", name: "White" },
                ].map((colour) => (
                  <button
                    key={colour.value}
                    style={{ background: colour.value }}
                    aria-label={t(`${colour.name} background`)}
                    aria-pressed={scene.background === colour.value}
                    onClick={() => onChange({ background: colour.value })}
                  />
                ))}
              </div>
            )}
            <label className="field-label inline-field">
              {t("Transition")}
              <select
                aria-label={t("Scene transition")}
                value={scene.transition}
                onChange={(event) =>
                  onChange({
                    transition: event.target.value as Scene["transition"],
                  })
                }
              >
                <option value="cut">{t("Straight cut")}</option>
                <option value="fade">{t("Fade through black")}</option>
              </select>
            </label>
          </section>
          {asset?.kind === "video" && (
            <section className="inspector-section">
              <h3>{t("Original sound")}</h3>
              <label className="range-label">
                {t("Clip volume")}
                <span>
                  {Math.round(scene.volume * 100)}
                  {t("%")}
                </span>
                <input
                  aria-label={t("Clip volume")}
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
            {t("Your originals stay just as they are.")}
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <SlidersHorizontal size={28} strokeWidth={1.3} />
          <h2>{t("Make it your own.")}</h2>
          <p>
            {t(
              "Select a scene to change its timing, add a title, or find the right frame.",
            )}
          </p>
          <span>{t("A small edit can say a lot.")}</span>
        </div>
      )}
    </aside>
  );
});
