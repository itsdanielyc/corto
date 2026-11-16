import { useRef, useState } from "react";
import type { Project, Subtitle } from "../../contracts/project";
import { parseSrt, serializeSrt, validateSubtitles } from "../domain/subtitles";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { Modal } from "./primitives";
import { TimingField } from "./TimingField";

/** Plain, editable timed captions stay local and portable; no transcription service is called. */
export function SubtitlesDialog({
  project,
  time,
  onChange,
  onClose,
}: {
  project: Project;
  time: number;
  onChange: (project: Project) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const commit = (cues: Subtitle[]) => {
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
    <Modal
      title="Timed subtitles"
      onClose={onClose}
      className="subtitles-dialog"
    >
      <p className="modal-introduction">
        Add speech captions or import an SRT file. Subtitles appear in preview
        and are burned into your exported movie.
      </p>
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
          Add subtitle at playhead
        </button>
        <button
          className="button secondary"
          onClick={() => input.current?.click()}
        >
          Import SRT
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
          Export SRT
        </button>
      </div>
      <p className="dialog-note">
        Times are seconds from the start of the film. Cues must not overlap.
        Import replaces the subtitle list and can be undone after closing this
        panel.
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
          <h3>Subtitle {index + 1}</h3>
          <div className="timing-fields">
            <TimingField
              label={`Subtitle ${index + 1} start`}
              value={cue.start}
              step={0.001}
              onCommit={(start) => change(cue.id, { start })}
            />
            <TimingField
              label={`Subtitle ${index + 1} end`}
              value={cue.end}
              step={0.001}
              onCommit={(end) => change(cue.id, { end })}
            />
          </div>
          <textarea
            aria-label={`Subtitle ${index + 1} text`}
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
            Remove subtitle {index + 1}
          </button>
        </section>
      ))}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
