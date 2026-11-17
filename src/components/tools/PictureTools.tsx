import type { MediaAsset, Project, Scene } from "../../../contracts/project";
import type { CortoPlatform } from "../../platform/types";
import { Choice, Colour, Slider, Toggle, ToolSection } from "./Fields";
import { autoAdjustments } from "../../domain/colour";
import { MediaPool } from "../../preview/media-pool";

export const MOTION_CHOICES = [
  ["none", "Still"],
  ["zoom-in", "Slow zoom in"],
  ["zoom-out", "Slow zoom out"],
  ["pan-left", "Pan left"],
  ["pan-right", "Pan right"],
  ["pan-up", "Pan up"],
  ["pan-down", "Pan down"],
  ["custom", "Custom start / end"],
] as const;
export const TRANSITION_CHOICES = [
  ["cut", "Straight cut"],
  ["fade", "Fade through black"],
  ["dissolve", "Cross dissolve"],
  ["fade-white", "Fade through white"],
  ["wipe-left", "Wipe left"],
  ["wipe-right", "Wipe right"],
  ["slide-left", "Slide left"],
  ["slide-right", "Slide right"],
  ["push-up", "Push up"],
  ["zoom", "Gentle zoom"],
  ["blur", "Soft blur"],
] as const;
export function PictureTools({
  project,
  scene,
  asset,
  platform,
  onChange,
  report,
}: {
  project: Project;
  scene: Scene;
  asset: MediaAsset | null;
  platform: CortoPlatform;
  onChange: (changes: Partial<Scene>) => void;
  report: (error: unknown) => void;
}) {
  const transform = (changes: Partial<Scene["transform"]>) =>
    onChange({ transform: { ...scene.transform, ...changes } });
  const enhance = async () => {
    if (!asset) return;
    const pool = new MediaPool();
    try {
      const media = await pool.get(asset, await platform.assetUrl(asset.id));
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(media, 0, 0, 64, 64);
      onChange({
        adjustments: {
          ...scene.adjustments,
          ...autoAdjustments(context.getImageData(0, 0, 64, 64).data),
        },
      });
    } finally {
      pool.dispose();
    }
  };
  return (
    <>
      {asset && (
        <ToolSection title="Framing & movement">
          <div className="tool-button-row">
            <button
              className="button secondary"
              onClick={() =>
                transform({
                  rotation: ((scene.transform.rotation + 90) %
                    360) as Scene["transform"]["rotation"],
                })
              }
            >
              Rotate 90°
            </button>
            <button
              className="button secondary"
              aria-pressed={scene.transform.flipX}
              onClick={() => transform({ flipX: !scene.transform.flipX })}
            >
              Flip horizontal
            </button>
            <button
              className="button secondary"
              aria-pressed={scene.transform.flipY}
              onClick={() => transform({ flipY: !scene.transform.flipY })}
            >
              Flip vertical
            </button>
          </div>
          <Choice
            label="Motion"
            value={scene.transform.motion}
            options={MOTION_CHOICES}
            onChange={(motion) => transform({ motion })}
          />
          <Choice
            label="Fit"
            value={scene.fit}
            options={[
              ["cover", "Fill / crop"],
              ["contain", "Show whole picture"],
            ]}
            onChange={(fit) => onChange({ fit })}
          />
          <Slider
            label="Crop focus X"
            value={scene.transform.focusX}
            onChange={(focusX) => transform({ focusX })}
          />
          <Slider
            label="Crop focus Y"
            value={scene.transform.focusY}
            onChange={(focusY) => transform({ focusY })}
          />
          <Slider
            label="Start zoom"
            value={scene.transform.zoom}
            min={1}
            max={6}
            onChange={(zoom) => transform({ zoom })}
          />
          {scene.transform.motion === "custom" && (
            <>
              <Slider
                label="End focus X"
                value={scene.transform.endFocusX}
                onChange={(endFocusX) => transform({ endFocusX })}
              />
              <Slider
                label="End focus Y"
                value={scene.transform.endFocusY}
                onChange={(endFocusY) => transform({ endFocusY })}
              />
              <Slider
                label="End zoom"
                value={scene.transform.endZoom}
                min={1}
                max={6}
                onChange={(endZoom) => transform({ endZoom })}
              />
            </>
          )}
        </ToolSection>
      )}
      <ToolSection title="Background">
        <Choice
          label="Background treatment"
          value={scene.backdrop.kind}
          options={[
            ["solid", "Solid colour"],
            ["gradient", "Gradient"],
            ["photo", "Photo background"],
            ...(asset ? [["blur", "Blurred picture"] as const] : []),
          ]}
          onChange={(kind) =>
            onChange({ backdrop: { ...scene.backdrop, kind } })
          }
        />
        {scene.backdrop.kind === "photo" && (
          <Choice
            label="Background photo"
            value={scene.backdrop.assetId ?? ""}
            options={[
              ["", "Choose a photo"],
              ...Object.values(project.assets)
                .filter(
                  (asset) => asset.kind === "image" && !asset.isOriginalOnly,
                )
                .map((asset) => [asset.id, asset.name] as const),
            ]}
            onChange={(assetId) =>
              onChange({
                backdrop: { ...scene.backdrop, assetId: assetId || null },
              })
            }
          />
        )}
        <Colour
          label="Background colour"
          value={scene.background}
          onChange={(background) => onChange({ background })}
        />
        {scene.backdrop.kind === "gradient" && (
          <>
            <Colour
              label="Second colour"
              value={scene.backdrop.secondColour}
              onChange={(secondColour) =>
                onChange({ backdrop: { ...scene.backdrop, secondColour } })
              }
            />
            <Slider
              label="Gradient angle"
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
      {asset && (
        <ToolSection title="Colour & looks">
          <Choice
            label="Look"
            value={scene.adjustments.look}
            options={[
              ["none", "Original"],
              ["mono", "Black & white"],
              ["sepia", "Sepia"],
              ["warm", "Warm"],
              ["cool", "Cool"],
              ["vivid", "Vivid"],
              ["faded", "Faded film"],
            ]}
            onChange={(look) =>
              onChange({ adjustments: { ...scene.adjustments, look } })
            }
          />
          {(["brightness", "contrast", "saturation", "warmth"] as const).map(
            (key) => (
              <Slider
                key={key}
                label={key[0].toUpperCase() + key.slice(1)}
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
          <button
            className="button secondary"
            onClick={() => {
              void enhance().catch(report);
            }}
          >
            Auto enhance
          </button>
          <button
            className="text-button"
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
            Reset colour
          </button>
          <Choice
            label="Imported .cube look"
            value={scene.adjustments.lutAssetId ?? ""}
            options={[
              ["", "No imported look"],
              ...Object.values(project.assets)
                .filter((asset) => asset.kind === "lut")
                .map((asset) => [asset.id, asset.name] as const),
            ]}
            onChange={(id) => {
              const { lutAssetId: _previous, ...settings } = scene.adjustments;
              onChange({
                adjustments: id ? { ...settings, lutAssetId: id } : settings,
              });
            }}
          />
          <p className="dialog-note">
            Import a .cube file with Import media, then choose it here.
          </p>
        </ToolSection>
      )}
      <ToolSection title="Transitions">
        <Choice
          label="Transition to next scene"
          value={scene.transition}
          options={TRANSITION_CHOICES}
          onChange={(transition) => onChange({ transition })}
        />
        <Slider
          label="Transition duration"
          value={scene.transitionSeconds}
          min={0}
          max={5}
          step={0.05}
          onChange={(transitionSeconds) => onChange({ transitionSeconds })}
        />
        <Toggle
          label="Shade picture behind the simple title"
          checked={scene.captionShade}
          onChange={(captionShade) => onChange({ captionShade })}
        />
      </ToolSection>
    </>
  );
}
