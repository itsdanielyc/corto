import type { MediaAsset, Scene } from "../../../contracts/project";
import type { MediaOperation } from "../../../contracts/services";
import { Choice, Numeric, Slider, Toggle, ToolSection } from "./Fields";

export function VideoTools({
  scene,
  asset,
  busy,
  onChange,
  onOperation,
}: {
  scene: Scene;
  asset: MediaAsset;
  busy: boolean;
  onChange: (changes: Partial<Scene>) => void;
  onOperation: (operation: MediaOperation["operation"]) => void;
}) {
  const maximumEnd = asset.duration;
  return (
    <>
      <ToolSection title="Trim the source">
        <Slider
          label="Visual trim in"
          value={scene.start}
          min={0}
          max={Math.max(0, maximumEnd - scene.duration * scene.speed)}
          step={0.01}
          onChange={(start) => onChange({ start })}
        />
        <Slider
          label="Visual trim out"
          value={scene.start + scene.duration * scene.speed}
          min={scene.start + 0.25 * scene.speed}
          max={maximumEnd}
          step={0.01}
          onChange={(end) =>
            onChange({ duration: (end - scene.start) / scene.speed })
          }
        />
        <Numeric
          label="Source in point"
          value={scene.start}
          max={maximumEnd - scene.duration * scene.speed}
          onChange={(start) => onChange({ start })}
        />
      </ToolSection>
      <ToolSection title="Speed & original sound">
        <Choice
          label="Playback speed"
          value={String(scene.speed)}
          options={[
            ["0.25", "¼ speed"],
            ["0.5", "½ speed"],
            ["1", "Normal"],
            ["1.5", "1½ speed"],
            ["2", "Double speed"],
            ["4", "4× speed"],
          ]}
          onChange={(value) => {
            const speed = Number(value);
            onChange({
              speed,
              duration: (scene.duration * scene.speed) / speed,
            });
          }}
        />
        <Toggle
          label="Preserve voice pitch"
          checked={scene.preservePitch}
          onChange={(preservePitch) => onChange({ preservePitch })}
        />
        <Toggle
          label="Loop this clip"
          checked={scene.loop}
          onChange={(loop) => onChange({ loop })}
        />
        <Slider
          label="Original audio gain"
          value={scene.volume}
          max={4}
          onChange={(volume) => onChange({ volume })}
        />
        <Numeric
          label="Original sound fade in"
          value={scene.audioFadeIn}
          max={scene.duration / 2}
          onChange={(audioFadeIn) => onChange({ audioFadeIn })}
        />
        <Numeric
          label="Original sound fade out"
          value={scene.audioFadeOut}
          max={scene.duration / 2}
          onChange={(audioFadeOut) => onChange({ audioFadeOut })}
        />
      </ToolSection>
      <ToolSection title="Non-destructive clip tools">
        <p className="dialog-note">
          Each operation creates a new local copy. Your original stays in the
          library.
        </p>
        <div className="tool-button-row">
          {(
            [
              ["audio", "Detach audio"],
              ["frame", "Insert freeze frame"],
              ["reverse", "Reverse clip"],
              ["stabilize", "Stabilize clip"],
              ["scenes", "Detect scene changes"],
              ["proxy", "Create editing proxy"],
              ["denoise", "Reduce sound noise"],
              ["normalize", "Normalize sound loudness"],
            ] as const
          ).map(([operation, title]) => (
            <button
              className="button secondary"
              key={operation}
              disabled={busy}
              onClick={() => onOperation(operation)}
            >
              {title}
            </button>
          ))}
        </div>
      </ToolSection>
      <ToolSection title="Chroma key">
        <Toggle
          label="Remove clip key colour"
          checked={!!scene.keyColour}
          onChange={(enabled) =>
            onChange({ keyColour: enabled ? "#00ff00" : null })
          }
        />
        {scene.keyColour && (
          <>
            <label className="field-label">
              Clip key colour
              <input
                aria-label="Clip key colour"
                type="color"
                value={scene.keyColour}
                onChange={(event) =>
                  onChange({ keyColour: event.target.value })
                }
              />
            </label>
            <Slider
              label="Clip key tolerance"
              value={scene.keyTolerance}
              min={0.01}
              max={0.8}
              onChange={(keyTolerance) => onChange({ keyTolerance })}
            />
          </>
        )}
      </ToolSection>
    </>
  );
}
