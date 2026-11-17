import { useState } from "react";
import { visualLayerSchema } from "../../../contracts/creative";
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
  const [selected, setSelected] = useState(scene.layers[0]?.id ?? "");
  const [mediaId, setMediaId] = useState("");
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
      <ToolSection title="Picture in picture & stickers">
        <Choice
          label="Overlay media"
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
            Add picture in picture
          </button>
          <button
            className="button secondary"
            disabled={scene.layers.length >= 8}
            onClick={() => add("shape")}
          >
            Add shape / sticker
          </button>
          <button
            className="button secondary"
            disabled={media.length < 2}
            onClick={() => collage(2)}
          >
            Two-picture split
          </button>
          <button
            className="button secondary"
            disabled={media.length < 4}
            onClick={() => collage(4)}
          >
            Four-picture collage
          </button>
        </div>
      </ToolSection>
      {layer && (
        <>
          <ToolSection title="Selected overlay">
            <Choice
              label="Overlay item"
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
                  label="Shape or sticker"
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
                  label="Shape colour"
                  value={layer.colour}
                  onChange={(colour) => update({ colour })}
                />
                <Colour
                  label="Shape outline"
                  value={layer.stroke}
                  onChange={(stroke) => update({ stroke })}
                />
                <Slider
                  label="Shape outline width"
                  value={layer.strokeWidth}
                  max={0.03}
                  step={0.001}
                  onChange={(strokeWidth) => update({ strokeWidth })}
                />
              </>
            ) : (
              <>
                <Choice
                  label="Overlay framing"
                  value={layer.fit}
                  options={[
                    ["cover", "Fill"],
                    ["contain", "Fit"],
                  ]}
                  onChange={(fit) => update({ fit })}
                />
                <Toggle
                  label="Loop overlay clip"
                  checked={layer.loop}
                  onChange={(loop) => update({ loop })}
                />
                <Slider
                  label="Overlay sound volume"
                  value={layer.volume}
                  max={4}
                  onChange={(volume) => update({ volume })}
                />
                <Toggle
                  label="Remove a key colour"
                  checked={!!layer.keyColour}
                  onChange={(enabled) =>
                    update({ keyColour: enabled ? "#00ff00" : null })
                  }
                />
                {layer.keyColour && (
                  <>
                    <Colour
                      label="Key colour"
                      value={layer.keyColour}
                      onChange={(keyColour) => update({ keyColour })}
                    />
                    <Slider
                      label="Key tolerance"
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
          <ToolSection title="Position & timing">
            <Slider
              label="Overlay X position"
              value={layer.x}
              min={-1}
              max={2}
              onChange={(x) => update({ x })}
            />
            <Slider
              label="Overlay Y position"
              value={layer.y}
              min={-1}
              max={2}
              onChange={(y) => update({ y })}
            />
            <Slider
              label="Overlay width"
              value={layer.width}
              min={0.02}
              max={2}
              onChange={(width) => update({ width })}
            />
            <Slider
              label="Overlay height"
              value={layer.height}
              min={0.02}
              max={2}
              onChange={(height) => update({ height })}
            />
            <Slider
              label="Overlay rotation"
              value={layer.rotation}
              min={-180}
              max={180}
              step={1}
              onChange={(rotation) => update({ rotation })}
            />
            <Slider
              label="Overlay opacity"
              value={layer.opacity}
              onChange={(opacity) => update({ opacity })}
            />
            <Numeric
              label="Overlay starts (seconds)"
              value={layer.start}
              max={(layer.end ?? scene.duration) - 0.01}
              onChange={(start) => update({ start })}
            />
            <Numeric
              label="Overlay ends (seconds)"
              value={layer.end ?? scene.duration}
              min={layer.start + 0.01}
              max={scene.duration}
              onChange={(end) => update({ end })}
            />
          </ToolSection>
          <ToolSection title="Simple end position">
            <Toggle
              label="Animate overlay position"
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
                  label="Overlay end X"
                  value={layer.endX}
                  min={-1}
                  max={2}
                  onChange={(endX) => update({ endX })}
                />
                <Slider
                  label="Overlay end Y"
                  value={layer.endY ?? layer.y}
                  min={-1}
                  max={2}
                  onChange={(endY) => update({ endY })}
                />
              </>
            )}
            <Slider
              label="Overlay end scale"
              value={layer.endScale}
              min={0.1}
              max={6}
              onChange={(endScale) => update({ endScale })}
            />
            <Slider
              label="Overlay end opacity"
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
              Remove this overlay
            </button>
          </ToolSection>
        </>
      )}
    </>
  );
}
