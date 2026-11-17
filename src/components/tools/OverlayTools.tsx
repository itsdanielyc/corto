import { useT } from "../../i18n/locale";
import { useState } from "react";
import { textItemSchema, visualLayerSchema } from "../../../contracts/creative";
import type { Project, Scene, VisualLayer } from "../../../contracts/project";
import { Choice, Colour, Numeric, Slider, Toggle, ToolSection } from "./Fields";
export function OverlayTools({
  project,
  scene,
  onChange,
}: {
  project: Project;
  scene: Scene;
  onChange: (changes: Partial<Scene>) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState(scene.layers[0]?.id ?? "");
  const [mediaId, setMediaId] = useState("");
  const [emoji, setEmoji] = useState("🎉");
  const media = Object.values(project.assets).filter(
    (asset) =>
      ["image", "video"].includes(asset.kind) &&
      !asset.isOriginalOnly &&
      !asset.isProxy,
  );
  const layer =
    scene.layers.find((candidate) => candidate.id === selected) ??
    scene.layers[0];
  const update = (changes: Partial<VisualLayer>) => {
    if (layer)
      onChange({
        layers: scene.layers.map((candidate) =>
          candidate.id === layer.id ? { ...layer, ...changes } : candidate,
        ),
      });
  };
  const add = (kind: VisualLayer["kind"], assetId: string | null = null) => {
    const item = visualLayerSchema.parse({
      id: crypto.randomUUID(),
      kind,
      assetId,
    });
    onChange({ layers: [...scene.layers, item] });
    setSelected(item.id);
  };
  const collage = (count: number) => {
    const assets = media.slice(0, count);
    if (assets.length < count) return;
    const layers = assets.map((asset, index) =>
      visualLayerSchema.parse({
        id: crypto.randomUUID(),
        kind: "media",
        assetId: asset.id,
        x: count === 2 ? index * 0.5 + 0.25 : (index % 2) * 0.5 + 0.25,
        y: count === 2 ? 0.5 : Math.floor(index / 2) * 0.5 + 0.25,
        width: 0.5,
        height: count === 2 ? 1 : 0.5,
        fit: "cover",
      }),
    );
    onChange({
      assetId: null,
      caption: "",
      layers,
      backdrop: { ...scene.backdrop, kind: "solid" },
    });
    setSelected(layers[0].id);
  };
  return (
    <>
      <ToolSection title={t("Picture in picture & stickers")}>
        <Choice
          label={t("Overlay media")}
          translateOptions={false}
          value={mediaId}
          options={[
            ["", "Choose a photo or clip"],
            ...media.map((asset) => [asset.id, asset.name] as const),
          ]}
          onChange={setMediaId}
        />
        <div className="tool-button-row">
          <button
            className="button secondary"
            disabled={!mediaId || scene.layers.length >= 8}
            onClick={() => add("media", mediaId)}
          >
            {t("Add picture in picture")}
          </button>
          <button
            className="button secondary"
            disabled={scene.layers.length >= 8}
            onClick={() => add("shape")}
          >
            {t("Add shape / sticker")}
          </button>
          <button
            className="button secondary"
            disabled={media.length < 2}
            onClick={() => collage(2)}
          >
            {t("Two-picture split")}
          </button>
          <button
            className="button secondary"
            disabled={media.length < 4}
            onClick={() => collage(4)}
          >
            {t("Four-picture collage")}
          </button>
        </div>
      </ToolSection>
      <ToolSection title={t("Emoji stickers")}>
        <label className="field-label">
          {t("Emoji sticker")}
          <input
            aria-label={t("Emoji sticker")}
            value={emoji}
            maxLength={32}
            onChange={(event) => setEmoji(event.target.value)}
          />
        </label>
        <button
          className="button secondary"
          disabled={!emoji.trim() || scene.textItems.length >= 24}
          onClick={() =>
            onChange({
              textItems: [
                ...scene.textItems,
                textItemSchema.parse({
                  id: crypto.randomUUID(),
                  text: emoji.trim(),
                  size: 0.2,
                  font: "sans",
                  shadow: false,
                }),
              ],
            })
          }
        >
          {t("Add emoji sticker")}
        </button>
      </ToolSection>
      {layer && (
        <>
          <ToolSection title={t("Selected overlay")}>
            <Choice
              label={t("Overlay item")}
              translateOptions={false}
              value={layer.id}
              options={scene.layers.map((item, index) => [
                item.id,
                `${index + 1}. ${item.assetId ? project.assets[item.assetId].name : item.shape}`,
              ])}
              onChange={setSelected}
            />
            {layer.kind !== "media" ? (
              <>
                <Choice
                  label={t("Shape or sticker")}
                  value={layer.shape}
                  options={[
                    ["rectangle", "Rectangle"],
                    ["ellipse", "Ellipse"],
                    ["arrow", "Arrow"],
                    ["line", "Line"],
                    ["star", "Star"],
                    ["heart", "Heart"],
                    ["balloon", "Balloon"],
                    ["confetti", "Confetti"],
                    ["sparkle", "Sparkle"],
                    ["flower", "Flower"],
                  ]}
                  onChange={(shape) => update({ shape })}
                />
                <Colour
                  label={t("Shape colour")}
                  value={layer.colour}
                  onChange={(colour) => update({ colour })}
                />
                <Colour
                  label={t("Shape outline")}
                  value={layer.stroke}
                  onChange={(stroke) => update({ stroke })}
                />
                <Slider
                  label={t("Shape outline width")}
                  value={layer.strokeWidth}
                  max={0.03}
                  step={0.001}
                  onChange={(strokeWidth) => update({ strokeWidth })}
                />
              </>
            ) : (
              <>
                <Choice
                  label={t("Overlay framing")}
                  value={layer.fit}
                  options={[
                    ["cover", "Fill"],
                    ["contain", "Fit"],
                  ]}
                  onChange={(fit) => update({ fit })}
                />
                <Toggle
                  label={t("Loop overlay clip")}
                  checked={layer.loop}
                  onChange={(loop) => update({ loop })}
                />
                {project.assets[layer.assetId!]?.kind === "video" &&
                  project.assets[layer.assetId!]?.hasAudio !== false && (
                    <Slider
                      label={t("Overlay sound volume")}
                      value={layer.volume}
                      max={4}
                      onChange={(volume) => update({ volume })}
                    />
                  )}
                <Toggle
                  label={t("Remove a key colour")}
                  checked={!!layer.keyColour}
                  onChange={(enabled) =>
                    update({ keyColour: enabled ? "#00ff00" : null })
                  }
                />
                {layer.keyColour && (
                  <>
                    <Colour
                      label={t("Key colour")}
                      value={layer.keyColour}
                      onChange={(keyColour) => update({ keyColour })}
                    />
                    <Slider
                      label={t("Key tolerance")}
                      value={layer.keyTolerance}
                      min={0.01}
                      max={0.8}
                      onChange={(keyTolerance) => update({ keyTolerance })}
                    />
                  </>
                )}
              </>
            )}
          </ToolSection>
          <ToolSection title={t("Position & timing")}>
            <Slider
              label={t("Overlay X position")}
              value={layer.x}
              min={-1}
              max={2}
              onChange={(x) => update({ x })}
            />
            <Slider
              label={t("Overlay Y position")}
              value={layer.y}
              min={-1}
              max={2}
              onChange={(y) => update({ y })}
            />
            <Slider
              label={t("Overlay width")}
              value={layer.width}
              min={0.02}
              max={2}
              onChange={(width) => update({ width })}
            />
            <Slider
              label={t("Overlay height")}
              value={layer.height}
              min={0.02}
              max={2}
              onChange={(height) => update({ height })}
            />
            <Slider
              label={t("Overlay rotation")}
              value={layer.rotation}
              min={-180}
              max={180}
              step={1}
              onChange={(rotation) => update({ rotation })}
            />
            <Slider
              label={t("Overlay opacity")}
              value={layer.opacity}
              onChange={(opacity) => update({ opacity })}
            />
            <Numeric
              label={t("Overlay starts (seconds)")}
              value={layer.start}
              max={(layer.end ?? scene.duration) - 0.01}
              onChange={(start) => update({ start })}
            />
            <Numeric
              label={t("Overlay ends (seconds)")}
              value={layer.end ?? scene.duration}
              min={layer.start + 0.01}
              max={scene.duration}
              onChange={(end) => update({ end })}
            />
          </ToolSection>
          <ToolSection title={t("Simple end position")}>
            <Toggle
              label={t("Animate overlay position")}
              checked={layer.endX !== null}
              onChange={(enabled) =>
                update({
                  endX: enabled ? layer.x : null,
                  endY: enabled ? layer.y : null,
                })
              }
            />
            {layer.endX !== null && (
              <>
                <Slider
                  label={t("Overlay end X")}
                  value={layer.endX}
                  min={-1}
                  max={2}
                  onChange={(endX) => update({ endX })}
                />
                <Slider
                  label={t("Overlay end Y")}
                  value={layer.endY ?? layer.y}
                  min={-1}
                  max={2}
                  onChange={(endY) => update({ endY })}
                />
              </>
            )}
            <Slider
              label={t("Overlay end scale")}
              value={layer.endScale}
              min={0.1}
              max={6}
              onChange={(endScale) => update({ endScale })}
            />
            <Slider
              label={t("Overlay end opacity")}
              value={layer.endOpacity ?? layer.opacity}
              onChange={(endOpacity) => update({ endOpacity })}
            />
            <button
              className="text-button"
              onClick={() =>
                onChange({
                  layers: scene.layers.filter((item) => item.id !== layer.id),
                })
              }
            >
              {t("Remove this overlay")}
            </button>
          </ToolSection>
        </>
      )}
    </>
  );
}
