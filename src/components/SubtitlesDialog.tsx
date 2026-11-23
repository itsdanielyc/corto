import { useT } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import { LIMITS, type Project, type Subtitle } from "../../contracts/project";
import { parseSrt, serializeSrt, validateSubtitles } from "../domain/subtitles";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { Panel } from "./primitives";
import { TimingField } from "./TimingField";
import type { CortoPlatform } from "../platform/types";
import { AutomaticCaptions } from "./AutomaticCaptions";
import { Choice, Colour, Slider } from "./tools/Fields";
const DEFAULT_CUE_SECONDS = 2;
const MILLISECONDS_PER_SECOND = 1000;
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
  onChange: (update: (project: Project) => Project) => void;
  onClose: () => void;
  platform: CortoPlatform;
}) {
  const t = useT();
  const cueStart =
    Math.round(time * MILLISECONDS_PER_SECOND) / MILLISECONDS_PER_SECOND;
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
      onChange((current) => ({ ...current, subtitles }));
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
  const changeStyle = (changes: Partial<Project["subtitleStyle"]>) =>
    onChange((current) => ({
      ...current,
      subtitleStyle: { ...current.subtitleStyle, ...changes },
    }));
  return (
    <Panel
      title={t("Timed subtitles")}
      onClose={onClose}
      className="subtitles-dialog"
    >
      <p className="modal-introduction">
        {t("Type captions or import an SRT file.")}
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
            onChange={(font) => changeStyle({ font })}
          />
          <Slider
            label={t("Subtitle size")}
            value={project.subtitleStyle.size}
            min={0.02}
            max={0.12}
            onChange={(size) => changeStyle({ size })}
          />
          <Colour
            label={t("Subtitle text colour")}
            value={project.subtitleStyle.colour}
            onChange={(colour) => changeStyle({ colour })}
          />
          <Colour
            label={t("Subtitle box colour")}
            value={project.subtitleStyle.boxColour}
            onChange={(boxColour) => changeStyle({ boxColour })}
          />
          <Slider
            label={t("Subtitle box opacity")}
            value={project.subtitleStyle.boxOpacity}
            onChange={(boxOpacity) => changeStyle({ boxOpacity })}
          />
          <Choice
            label={t("Subtitle position")}
            value={project.subtitleStyle.position}
            options={[
              ["top", "Top"],
              ["middle", "Middle"],
              ["bottom", "Bottom"],
            ]}
            onChange={(position) => changeStyle({ position })}
          />
        </div>
      </details>
      <fieldset disabled={generating} className="subtitle-manual-controls">
        <div className="dialog-toolbar">
          <button
            className="button secondary"
            disabled={cueStart >= LIMITS.filmSeconds}
            onClick={() =>
              commit([
                ...project.subtitles,
                {
                  id: crypto.randomUUID(),
                  start: cueStart,
                  end: Math.min(
                    LIMITS.filmSeconds,
                    cueStart + DEFAULT_CUE_SECONDS,
                  ),
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
