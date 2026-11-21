import { useT } from "../../i18n/locale";
import { FlipHorizontal2, FlipVertical2, Frame, RotateCw } from "lucide-react";
import type { MediaAsset, Project, Scene } from "../../../contracts/project";
import type { CortoPlatform } from "../../platform/types";
import { Choice, Colour, Slider, ToolSection } from "./Fields";
import { changeScene } from "../../domain/project";
import { autoAdjustments } from "../../domain/colour";
import { MediaPool } from "../../preview/media-pool";
import { LookTiles, MotionTiles, TransitionTiles } from "./Choices";
export { MOTION_CHOICES, TRANSITION_CHOICES } from "./choice-lists";

interface PictureProperties {
  project: Project;
  scene: Scene;
  asset: MediaAsset | null;
  poster?: string;
  platform: CortoPlatform;
  onChange: (changes: Partial<Scene>) => void;
  report: (error: unknown) => void;
  /** Opens start/end framing directly on the stage picture. */
  onFrame?: () => void;
}

/** Fill or fit: the one framing decision every photo needs. */
export function FitChoice({
  scene,
  onChange,
}: Pick<PictureProperties, "scene" | "onChange">) {
  const t = useT();
  return (
    <div className="segmented" role="group" aria-label={t("Picture framing")}>
      <button
        type="button"
        aria-pressed={scene.fit === "cover"}
        onClick={() => onChange({ fit: "cover" })}
      >
        {t("Fill frame")}
      </button>
      <button
        type="button"
        aria-pressed={scene.fit === "contain"}
        onClick={() => onChange({ fit: "contain" })}
      >
        {t("Fit whole image")}
      </button>
    </div>
  );
}

/** Camera movement, orientation and the precise (non-drag) framing values. */
export function MotionSection({
  scene,
  asset,
  poster,
  onChange,
  onFrame,
}: Pick<
  PictureProperties,
  "scene" | "asset" | "poster" | "onChange" | "onFrame"
>) {
  const t = useT();
  const transform = (changes: Partial<Scene["transform"]>) =>
    onChange({ transform: { ...scene.transform, ...changes } });
  if (!asset) return null;
  return (
    <ToolSection title={t("Framing & movement")}>
      <FitChoice scene={scene} onChange={onChange} />
      <MotionTiles
        value={scene.transform.motion}
        poster={poster}
        onChange={(motion) => transform({ motion })}
      />
      {onFrame && asset.kind === "image" && (
        <button className="button secondary wide" onClick={onFrame}>
          <Frame size={16} aria-hidden="true" />
          {t("Set start and end on the picture")}
        </button>
      )}
      <div className="tool-button-row orientation-row">
        <button
          className="button secondary"
          onClick={() =>
            transform({
              rotation: ((scene.transform.rotation + 90) %
                360) as Scene["transform"]["rotation"],
            })
          }
        >
          <RotateCw size={15} aria-hidden="true" />
          {t("Rotate 90°")}
        </button>
        <button
          className="button secondary"
          aria-pressed={scene.transform.flipX}
          onClick={() => transform({ flipX: !scene.transform.flipX })}
        >
          <FlipHorizontal2 size={15} aria-hidden="true" />
          <span className="sr-only">{t("Flip horizontal")}</span>
        </button>
        <button
          className="button secondary"
          aria-pressed={scene.transform.flipY}
          onClick={() => transform({ flipY: !scene.transform.flipY })}
        >
          <FlipVertical2 size={15} aria-hidden="true" />
          <span className="sr-only">{t("Flip vertical")}</span>
        </button>
      </div>
      <details className="fine-controls">
        <summary>{t("Exact framing")}</summary>
        <div className="tool-fields">
          <Slider
            label={t("Crop focus X")}
            value={scene.transform.focusX}
            onChange={(focusX) => transform({ focusX })}
          />
          <Slider
            label={t("Crop focus Y")}
            value={scene.transform.focusY}
            onChange={(focusY) => transform({ focusY })}
          />
          <Slider
            label={t("Start zoom")}
            value={scene.transform.zoom}
            min={1}
            max={6}
            onChange={(zoom) => transform({ zoom })}
          />
          {scene.transform.motion === "custom" && (
            <>
              <Slider
                label={t("End focus X")}
                value={scene.transform.endFocusX}
                onChange={(endFocusX) => transform({ endFocusX })}
              />
              <Slider
                label={t("End focus Y")}
                value={scene.transform.endFocusY}
                onChange={(endFocusY) => transform({ endFocusY })}
              />
              <Slider
                label={t("End zoom")}
                value={scene.transform.endZoom}
                min={1}
                max={6}
                onChange={(endZoom) => transform({ endZoom })}
              />
            </>
          )}
        </div>
      </details>
    </ToolSection>
  );
}

/** Looks first (what most people want), then the individual adjustments. */
export function ColourSection({
  project,
  scene,
  asset,
  poster,
  platform,
  onChange,
  onProject,
  report,
}: PictureProperties & {
  onProject: (update: (project: Project) => Project) => void;
}) {
  const t = useT();
  if (!asset) return null;
  const enhance = async () => {
    const pool = new MediaPool();
    try {
      const media = await pool.get(asset, await platform.assetUrl(asset.id));
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(media, 0, 0, 64, 64);
      const adjustments = autoAdjustments(
        context.getImageData(0, 0, 64, 64).data,
      );
      onProject((current) => {
        if (current.id !== project.id) return current;
        const original = current.scenes.find((item) => item.id === scene.id);
        if (original?.assetId !== asset.id) return current;
        return changeScene(current, original.id, {
          adjustments: { ...original.adjustments, ...adjustments },
        });
      });
    } finally {
      pool.dispose();
    }
  };
  return (
    <ToolSection title={t("Look")}>
      <LookTiles
        value={scene.adjustments.look}
        poster={poster}
        onChange={(look) =>
          onChange({ adjustments: { ...scene.adjustments, look } })
        }
      />
      <div className="tool-button-row">
        <button
          className="button secondary"
          onClick={() => {
            void enhance().catch(report);
          }}
        >
          {t("Auto enhance")}
        </button>
        <button
          className="button quiet"
          onClick={() =>
            onChange({
              adjustments: {
                brightness: 0,
                contrast: 0,
                saturation: 0,
                warmth: 0,
                look: "none",
              },
            })
          }
        >
          {t("Reset colour")}
        </button>
      </div>
      <details className="fine-controls">
        <summary>{t("Adjust colour")}</summary>
        <div className="tool-fields">
          {(["brightness", "contrast", "saturation", "warmth"] as const).map(
            (key) => (
              <Slider
                key={key}
                label={t(key[0].toUpperCase() + key.slice(1))}
                value={scene.adjustments[key]}
                min={key === "contrast" ? -0.9 : -1}
                max={1}
                onChange={(value) =>
                  onChange({
                    adjustments: { ...scene.adjustments, [key]: value },
                  })
                }
              />
            ),
          )}
          <Choice
            label={t("Imported .cube look")}
            translateOptions={false}
            value={scene.adjustments.lutAssetId ?? ""}
            options={[
              ["", t("No imported look")],
              ...Object.values(project.assets)
                .filter((candidate) => candidate.kind === "lut")
                .map((candidate) => [candidate.id, candidate.name] as const),
            ]}
            onChange={(id) => {
              const { lutAssetId: _previous, ...settings } = scene.adjustments;
              onChange({
                adjustments: id ? { ...settings, lutAssetId: id } : settings,
              });
            }}
          />
          <p className="dialog-note">
            {t("Import a .cube file with Import media, then choose it here.")}
          </p>
        </div>
      </details>
    </ToolSection>
  );
}

const CARD_COLOURS = [
  { value: "#151517", name: "Graphite" },
  { value: "#e8e5dd", name: "Paper" },
  { value: "#ffffff", name: "White" },
  { value: "#2b3a4a", name: "Ink blue" },
  { value: "#4a2f2a", name: "Umber" },
] as const;

/** What sits behind the picture (or forms the whole title card). */
export function BackgroundSection({
  project,
  scene,
  asset,
  onChange,
  title,
}: Pick<PictureProperties, "project" | "scene" | "asset" | "onChange"> & {
  title: string;
}) {
  const t = useT();
  return (
    <ToolSection title={t(title)}>
      {!asset && (
        <div
          className="background-swatches"
          role="group"
          aria-label={t("Title background")}
        >
          {CARD_COLOURS.map((colour) => (
            <button
              key={colour.value}
              type="button"
              style={{ background: colour.value }}
              aria-label={t(`${colour.name} background`)}
              aria-pressed={scene.background === colour.value}
              onClick={() => onChange({ background: colour.value })}
            />
          ))}
        </div>
      )}
      <Choice
        label={t("Background treatment")}
        value={scene.backdrop.kind}
        options={[
          ["solid", "Solid colour"],
          ["gradient", "Gradient"],
          ["photo", "Photo background"],
          ...(asset ? [["blur", "Blurred picture"] as const] : []),
        ]}
        onChange={(kind) => onChange({ backdrop: { ...scene.backdrop, kind } })}
      />
      {scene.backdrop.kind === "photo" && (
        <Choice
          label={t("Background photo")}
          translateOptions={false}
          value={scene.backdrop.assetId ?? ""}
          options={[
            ["", t("Choose a photo")],
            ...Object.values(project.assets)
              .filter(
                (candidate) =>
                  candidate.kind === "image" && !candidate.isOriginalOnly,
              )
              .map((candidate) => [candidate.id, candidate.name] as const),
          ]}
          onChange={(assetId) =>
            onChange({
              backdrop: { ...scene.backdrop, assetId: assetId || null },
            })
          }
        />
      )}
      <Colour
        label={t("Background colour")}
        value={scene.background}
        onChange={(background) => onChange({ background })}
      />
      {scene.backdrop.kind === "gradient" && (
        <>
          <Colour
            label={t("Second colour")}
            value={scene.backdrop.secondColour}
            onChange={(secondColour) =>
              onChange({ backdrop: { ...scene.backdrop, secondColour } })
            }
          />
          <Slider
            label={t("Gradient angle")}
            value={scene.backdrop.angle}
            max={360}
            step={1}
            onChange={(angle) =>
              onChange({ backdrop: { ...scene.backdrop, angle } })
            }
          />
        </>
      )}
    </ToolSection>
  );
}

/** The join into the next scene; the same control appears at the seam in the reel. */
export function TransitionSection({
  scene,
  isLast,
  onChange,
}: Pick<PictureProperties, "scene" | "onChange"> & { isLast: boolean }) {
  const t = useT();
  return (
    <ToolSection title={t("Into the next scene")}>
      {isLast && (
        <p className="dialog-note">
          {t("This is the last scene; the transition applies if you add more.")}
        </p>
      )}
      <TransitionTiles
        value={scene.transition}
        onChange={(transition) => onChange({ transition })}
      />
      {scene.transition !== "cut" && (
        <Slider
          label={t("Transition duration")}
          value={scene.transitionSeconds}
          min={0}
          max={5}
          step={0.05}
          onChange={(transitionSeconds) => onChange({ transitionSeconds })}
        />
      )}
    </ToolSection>
  );
}
