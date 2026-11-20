import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import type { Project, Subtitle } from "../../contracts/project";
import { parseSrt, serializeSrt, validateSubtitles } from "../domain/subtitles";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { Panel } from "./primitives";
import { TimingField } from "./TimingField";
import type { CortoPlatform } from "../platform/types";
import { AutomaticCaptions } from "./AutomaticCaptions";
import { Choice, Colour, Slider } from "./tools/Fields";
/** Plain, editable timed captions stay local and portable; no transcription service is called. */
export function SubtitlesDialog({
  project,
  time,
  onChange,
  onClose,
  platform,
}: {
  project: Project;
  time: number;
  onChange: (project: Project) => void;
  onClose: () => void;
  platform: CortoPlatform;
}) {
  const t = useT();
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const commit = (cues: Subtitle[]) => {
    if (!mounted.current) return;
    try {
      const subtitles = validateSubtitles(
        [...cues].sort((a, b) => a.start - b.start),
      );
      onChange({ ...project, subtitles });
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };
  const change = (id: string, changes: Partial<Subtitle>) =>
    commit(
      project.subtitles.map((cue) =>
        cue.id === id ? { ...cue, ...changes } : cue,
      ),
    );
  return (
    <Panel
      title={t("Timed subtitles")}
      onClose={onClose}
      className="subtitles-dialog"
    >
      <p className="modal-introduction">
        {t(
          "Type captions or import an SRT file.",
        )}
      </p>
      <AutomaticCaptions
        project={project}
        platform={platform}
        onCues={commit}
        onBusy={setGenerating}
      />
      <details className="subtitle-style-controls">
        <summary>{t("Subtitle style")}</summary>
        <div className="tool-fields">
          <Choice
            label={t("Subtitle font")}
            value={project.subtitleStyle.font}
            options={[
              ["sans", "Manrope"],
              ["serif", "DM Serif Display"],
              ["mono", "Monospace"],
              ["rounded", "Rounded"],
            ]}
            onChange={(font) =>
              onChange({
                ...project,
                subtitleStyle: { ...project.subtitleStyle, font },
              })
            }
          />
          <Slider
            label={t("Subtitle size")}
            value={project.subtitleStyle.size}
            min={0.02}
            max={0.12}
            onChange={(size) =>
              onChange({
                ...project,
                subtitleStyle: { ...project.subtitleStyle, size },
              })
            }
          />
          <Colour
            label={t("Subtitle text colour")}
            value={project.subtitleStyle.colour}
            onChange={(colour) =>
              onChange({
                ...project,
                subtitleStyle: { ...project.subtitleStyle, colour },
              })
            }
          />
          <Colour
            label={t("Subtitle box colour")}
            value={project.subtitleStyle.boxColour}
            onChange={(boxColour) =>
              onChange({
                ...project,
                subtitleStyle: { ...project.subtitleStyle, boxColour },
              })
            }
          />
          <Slider
            label={t("Subtitle box opacity")}
            value={project.subtitleStyle.boxOpacity}
            onChange={(boxOpacity) =>
              onChange({
                ...project,
                subtitleStyle: { ...project.subtitleStyle, boxOpacity },
              })
            }
          />
          <Choice
            label={t("Subtitle position")}
            value={project.subtitleStyle.position}
            options={[
              ["top", "Top"],
              ["middle", "Middle"],
              ["bottom", "Bottom"],
            ]}
            onChange={(position) =>
              onChange({
                ...project,
                subtitleStyle: { ...project.subtitleStyle, position },
              })
            }
          />
        </div>
      </details>
      <fieldset disabled={generating} className="subtitle-manual-controls">
        <div className="dialog-toolbar">
          <button
            className="button primary"
            onClick={() =>
              commit([
                ...project.subtitles,
                {
                  id: crypto.randomUUID(),
                  start: Math.round(time * 1000) / 1000,
                  end: Math.min(1800, Math.round(time * 1000) / 1000 + 2),
                  text: "Your subtitle",
                },
              ])
            }
          >
            {t("Add subtitle at playhead")}
          </button>
          <button
            className="button secondary"
            onClick={() => input.current?.click()}
          >
            {t("Import SRT")}
          </button>
          <button
            className="button secondary"
            disabled={!project.subtitles.length}
            onClick={() => {
              downloadBlob(
                new Blob([serializeSrt(project.subtitles)], {
                  type: "application/x-subrip;charset=utf-8",
                }),
                `${projectFileName(project.name)}.srt`,
              );
            }}
          >
            {t("Export SRT")}
          </button>
        </div>
        <p className="dialog-note">
          {t(
            "Times are seconds from the start of the film. Cues must not overlap. Import replaces the subtitle list and can be undone after closing this panel.",
          )}
        </p>
        <input
          ref={input}
          data-testid="subtitle-input"
          type="file"
          hidden
          accept=".srt"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            if (file.size > 512 * 1024) {
              setError("This subtitle file is too large");
              return;
            }
            void file
              .text()
              .then((text) => commit(parseSrt(text)))
              .catch((failure) => setError(String(failure)));
          }}
        />
        {project.subtitles.map((cue, index) => (
          <section className="subtitle-row" key={cue.id}>
            <h3>
              {t("Subtitle ")}
              {index + 1}
            </h3>
            <div className="timing-fields">
              <TimingField
                label={t(`Subtitle ${index + 1} start`)}
                value={cue.start}
                step={0.001}
                onCommit={(start) => change(cue.id, { start })}
              />
              <TimingField
                label={t(`Subtitle ${index + 1} end`)}
                value={cue.end}
                step={0.001}
                onCommit={(end) => change(cue.id, { end })}
              />
            </div>
            <textarea
              aria-label={t(`Subtitle ${index + 1} text`)}
              maxLength={240}
              defaultValue={cue.text}
              key={cue.text}
              onBlur={(event) => {
                if (event.target.value !== cue.text)
                  change(cue.id, { text: event.target.value });
              }}
            />
            <button
              className="text-button"
              onClick={() =>
                commit(project.subtitles.filter((item) => item.id !== cue.id))
              }
            >
              {t("Remove subtitle ")}
              {index + 1}
            </button>
          </section>
        ))}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    </Panel>
  );
}
