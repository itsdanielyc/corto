import { useT } from "../i18n/locale";
import { memo, useEffect, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Minus,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import {
  LIMITS,
  type MediaAsset,
  type Project,
  type Scene,
} from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import type { MediaResources } from "../hooks/use-resources";
import { useSceneOperations } from "../hooks/use-scene-operations";
import { IconButton } from "./primitives";
import {
  BackgroundSection,
  ColourSection,
  MotionSection,
  TransitionSection,
} from "./tools/PictureTools";
import { TileChoice } from "./tools/Choices";
import { Numeric, Toggle, ToolSection } from "./tools/Fields";
import { TextTools } from "./tools/TextTools";
import { OverlayTools } from "./tools/OverlayTools";
import { VideoTools } from "./tools/VideoTools";
import { BackgroundRemoval } from "./BackgroundRemoval";
import { RATIO_CHOICES } from "./Stage";
import { TRANSITION_CHOICES } from "./tools/choice-lists";

/** Inspector tabs; "look" is Picture for media and Card for title cards. */
export type InspectorTab = "look" | "clip" | "text" | "overlays" | "timing";

/** Seconds added or removed by the duration stepper. */
const DURATION_STEP = 0.5;

interface InspectorProperties {
  project: Project;
  scene: Scene | null;
  asset: MediaAsset | null;
  index: number;
  count: number;
  resources: MediaResources;
  platform: CortoPlatform;
  time: number;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onChange: (changes: Partial<Scene>) => void;
  onProject: (update: (project: Project) => Project) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onMove: (direction: number) => void;
  onFrame: () => void;
  report: (error: unknown) => void;
  busy: boolean;
}

/** A seconds field that commits on blur or Enter and steps in half seconds. */
function SecondsField({
  value,
  label,
  minimum,
  maximum,
  onCommit,
  stepper = false,
}: {
  value: number;
  label: string;
  minimum: number;
  maximum: number;
  onCommit: (value: number) => void;
  stepper?: boolean;
}) {
  const t = useT();
  const format = (number: number) => String(Number(number.toFixed(3)));
  const [draft, setDraft] = useState(format(value));
  useEffect(() => setDraft(format(value)), [value]);
  const clamp = (number: number) =>
    Math.max(minimum, Math.min(maximum, number));
  return (
    <label className="field-label seconds-field">
      {label}
      <span className="number-wrap">
        {stepper && (
          <button
            type="button"
            className="stepper"
            aria-label={t("Shorter")}
            disabled={value <= minimum}
            onClick={() => onCommit(clamp(value - DURATION_STEP))}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
        )}
        <input
          aria-label={t(label)}
          type="number"
          min={minimum}
          max={maximum}
          step="0.25"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const parsed = Number(draft);
            if (draft.trim() && Number.isFinite(parsed)) {
              const bounded = clamp(parsed);
              if (bounded !== value) onCommit(bounded);
            }
            setDraft(format(value));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span className="unit">{t("sec")}</span>
        {stepper && (
          <button
            type="button"
            className="stepper"
            aria-label={t("Longer")}
            disabled={value >= maximum}
            onClick={() => onCommit(clamp(value + DURATION_STEP))}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        )}
      </span>
    </label>
  );
}

const TITLE_STYLES = ["classic", "modern", "minimal"] as const;

/** The simple on-screen words every scene can carry. */
function WordsSection({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (changes: Partial<Scene>) => void;
}) {
  const t = useT();
  return (
    <ToolSection title={t("Words")}>
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
      <div className="type-styles" role="group" aria-label={t("Title style")}>
        {TITLE_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            aria-label={t(
              `${style[0].toUpperCase()}${style.slice(1)} title style`,
            )}
            aria-pressed={scene.captionStyle === style}
            className={`type-style ${style}`}
            onClick={() => onChange({ captionStyle: style })}
          >
            <span className={`type-style-art caption-${style}`}>
              {style === "minimal" ? "AA" : "Aa"}
            </span>
            <small>{t(style[0].toUpperCase() + style.slice(1))}</small>
          </button>
        ))}
      </div>
      <div className="segmented" role="group" aria-label={t("Title position")}>
        <button
          type="button"
          aria-pressed={scene.captionPosition === "center"}
          onClick={() => onChange({ captionPosition: "center" })}
        >
          {t("Centre")}
        </button>
        <button
          type="button"
          aria-pressed={scene.captionPosition === "bottom"}
          onClick={() => onChange({ captionPosition: "bottom" })}
        >
          {t("Lower third")}
        </button>
      </div>
      <Toggle
        label={t("Shade picture behind the words")}
        checked={scene.captionShade}
        onChange={(captionShade) => onChange({ captionShade })}
      />
    </ToolSection>
  );
}

function SceneHeading({
  scene,
  asset,
  poster,
  index,
  count,
  busy,
  onMove,
  onDuplicate,
  onDelete,
}: {
  scene: Scene;
  asset: MediaAsset | null;
  poster?: string;
  index: number;
  count: number;
  busy: boolean;
  onMove: (direction: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const kind =
    asset?.kind === "video" ? t("Clip") : asset ? t("Photo") : t("Title card");
  return (
    <div className="inspector-heading">
      <span
        className="inspector-thumb"
        style={!asset ? { background: scene.background } : undefined}
        aria-hidden="true"
      >
        {poster && <img src={poster} alt="" />}
      </span>
      <div className="inspector-title">
        <h2>
          {t("Scene ")}
          {index + 1}
        </h2>
        <span>
          {kind}
          {t(" · ")}
          {Number(scene.duration.toFixed(2))}
          {t(" s")}
        </span>
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
    </div>
  );
}

/** Everything about one scene, grouped by what you are changing. */
function SceneInspector(properties: InspectorProperties & { scene: Scene }) {
  const t = useT();
  const { project, scene, asset, platform, onChange, tab, report } = properties;
  const poster = asset
    ? (properties.resources[asset.id]?.poster ?? undefined)
    : undefined;
  const operations = useSceneOperations({
    project,
    scene,
    platform,
    time: properties.time,
    onProject: properties.onProject,
  });
  const video = asset?.kind === "video";
  const tabs: [InspectorTab, string][] = [
    ["look", asset ? "Picture" : "Card"],
    ...(video ? [["clip", "Clip"] as [InspectorTab, string]] : []),
    ["text", "Text"],
    ["overlays", "Overlays"],
    ["timing", "Timing"],
  ];
  const active = tabs.some(([id]) => id === tab) ? tab : "look";
  return (
    <>
      <SceneHeading
        scene={scene}
        asset={asset}
        poster={poster}
        index={properties.index}
        count={properties.count}
        busy={properties.busy || operations.busy}
        onMove={properties.onMove}
        onDuplicate={properties.onDuplicate}
        onDelete={properties.onDelete}
      />
      <div
        className="tool-tabs"
        role="tablist"
        aria-label={t("Scene tool categories")}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          const index = tabs.findIndex(([id]) => id === active);
          const next =
            tabs[
              (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                tabs.length
            ][0];
          properties.onTab(next);
          event.currentTarget
            .querySelector<HTMLElement>(`[data-tab="${next}"]`)
            ?.focus();
        }}
      >
        {tabs.map(([id, name]) => (
          <button
            role="tab"
            key={id}
            data-tab={id}
            aria-selected={active === id}
            tabIndex={active === id ? 0 : -1}
            onClick={() => properties.onTab(id)}
          >
            {t(name)}
          </button>
        ))}
      </div>
      {operations.operationError && (
        <p className="inline-error inspector-error" role="alert">
          {t(operations.operationError)}
        </p>
      )}
      <div
        className="inspector-body"
        role="tabpanel"
        aria-label={t(tabs.find(([id]) => id === active)![1])}
        key={`${scene.id}-${active}`}
      >
        <fieldset className="inspector-fields" disabled={operations.busy}>
          {active === "look" && asset && (
            <>
              <MotionSection
                scene={scene}
                asset={asset}
                poster={poster}
                onChange={onChange}
                onFrame={properties.onFrame}
              />
              <ColourSection
                project={project}
                scene={scene}
                asset={asset}
                poster={poster}
                platform={platform}
                onChange={onChange}
                onProject={properties.onProject}
                report={report}
              />
              {asset.kind === "image" && (
                <ToolSection title={t("Cut-out")}>
                  <BackgroundRemoval
                    scene={scene}
                    asset={asset}
                    platform={platform}
                    onChange={properties.onProject}
                  />
                </ToolSection>
              )}
              <details className="fine-controls section-details">
                <summary>{t("Behind the picture")}</summary>
                <BackgroundSection
                  project={project}
                  scene={scene}
                  asset={asset}
                  onChange={onChange}
                  title="Background"
                />
              </details>
              <div className="inspector-footer-actions">
                <button
                  className="button quiet"
                  onClick={() => {
                    void operations.saveFrame().catch(report);
                  }}
                >
                  {t("Save composed frame as PNG")}
                </button>
              </div>
            </>
          )}
          {active === "look" && !asset && (
            <BackgroundSection
              project={project}
              scene={scene}
              asset={null}
              onChange={onChange}
              title="Card"
            />
          )}
          {active === "clip" && asset?.kind === "video" && (
            <>
              <ToolSection title={t("Original sound")}>
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
                    style={
                      {
                        "--progress": `${Math.min(100, scene.volume * 100)}%`,
                      } as CSSProperties
                    }
                    onChange={(event) =>
                      onChange({ volume: Number(event.target.value) / 100 })
                    }
                  />
                </label>
              </ToolSection>
              <VideoTools
                scene={scene}
                asset={asset}
                busy={operations.busy}
                onChange={onChange}
                onOperation={(operation) => {
                  void operations.process(operation).catch(report);
                }}
              />
            </>
          )}
          {active === "text" && (
            <>
              <WordsSection scene={scene} onChange={onChange} />
              <TextTools scene={scene} onChange={onChange} />
            </>
          )}
          {active === "overlays" && (
            <OverlayTools project={project} scene={scene} onChange={onChange} />
          )}
          {active === "timing" && (
            <>
              <ToolSection title={t("Length")}>
                <SecondsField
                  stepper
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
                {asset?.kind === "video" && (
                  <SecondsField
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
                <button
                  className="button secondary split-button"
                  onClick={properties.onSplit}
                  disabled={
                    properties.busy ||
                    scene.duration < LIMITS.minimumSceneSeconds * 2
                  }
                >
                  <Scissors size={15} aria-hidden="true" />
                  {t("Split scene at the playhead")}
                </button>
              </ToolSection>
              <TransitionSection
                scene={scene}
                isLast={properties.index === properties.count - 1}
                onChange={onChange}
              />
            </>
          )}
        </fieldset>
      </div>
      {operations.busy && (
        <div className="inspector-busy" role="status">
          <span>{t("Working on this clip…")}</span>
          <button className="button secondary" onClick={operations.cancel}>
            {t("Cancel media operation")}
          </button>
        </div>
      )}
    </>
  );
}

/** With no scenes yet, the panel sets up the film itself. */
function FilmInspector({
  project,
  onProject,
}: Pick<InspectorProperties, "project" | "onProject">) {
  const t = useT();
  const defaults = project.defaults;
  const setDefaults = (changes: Partial<Project["defaults"]>) =>
    onProject((current) => ({
      ...current,
      defaults: { ...current.defaults, ...changes },
    }));
  return (
    <>
      <div className="inspector-heading film-heading">
        <div className="inspector-title">
          <h2>{t("This film")}</h2>
          <span>{t("Settings for scenes you add")}</span>
        </div>
      </div>
      <div className="inspector-body">
        <ToolSection title={t("Shape")}>
          <TileChoice
            label="Film shape"
            value={project.ratio}
            options={RATIO_CHOICES.map(
              ([value, label]) => [value, label.split(" · ")[1]] as const,
            )}
            onChange={(ratio) =>
              onProject((current) => ({ ...current, ratio }))
            }
            className="shape-tiles"
            art={(ratio) => <span className={`shape-art shape-${ratio}`} />}
          />
        </ToolSection>
        <ToolSection title={t("New photos")}>
          <Numeric
            label={t("Seconds per photo")}
            value={defaults.photoSeconds}
            min={0.25}
            max={120}
            step={0.25}
            onChange={(photoSeconds) => setDefaults({ photoSeconds })}
          />
          <div
            className="segmented"
            role="group"
            aria-label={t("New photo framing")}
          >
            <button
              type="button"
              aria-pressed={defaults.fit === "cover"}
              onClick={() => setDefaults({ fit: "cover" })}
            >
              {t("Fill frame")}
            </button>
            <button
              type="button"
              aria-pressed={defaults.fit === "contain"}
              onClick={() => setDefaults({ fit: "contain" })}
            >
              {t("Fit whole image")}
            </button>
          </div>
        </ToolSection>
        <ToolSection title={t("Between scenes")}>
          <label className="field-label">
            {t("Default transition")}
            <select
              aria-label={t("Default transition")}
              value={defaults.transition}
              onChange={(event) =>
                setDefaults({
                  transition: event.target.value as Scene["transition"],
                })
              }
            >
              {TRANSITION_CHOICES.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
        </ToolSection>
      </div>
    </>
  );
}

/** The right panel follows the selection: one scene, or the film itself. */
export const Inspector = memo(function Inspector(
  properties: InspectorProperties,
) {
  const t = useT();
  return (
    <aside
      className="inspector"
      aria-label={t("Scene settings")}
      data-geo="inspector"
    >
      {properties.scene ? (
        <SceneInspector {...properties} scene={properties.scene} />
      ) : (
        <FilmInspector
          project={properties.project}
          onProject={properties.onProject}
        />
      )}
    </aside>
  );
});
