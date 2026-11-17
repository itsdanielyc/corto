import { useEffect, useRef, useState } from "react";
import type { AudioClip, Project } from "../../contracts/project";
import { parseProject } from "../../contracts/project";
import { addAsset } from "../domain/project";
import {
  createAudioClip,
  placeNextSong,
  projectAudioClips,
  editSound,
} from "../domain/audio";
import { importMedia } from "../media/phone";
import type { CortoPlatform } from "../platform/types";
import { Modal } from "./primitives";
import { TimingField } from "./TimingField";
import { VoiceRecorder } from "./VoiceRecorder";

/** A list of placed sounds provides simple timing without introducing a multitrack video editor. */
export function SoundDialog({
  project,
  platform,
  time,
  onChange,
  onClose,
}: {
  project: Project;
  platform: CortoPlatform;
  time: number;
  onChange: (project: Project) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const current = useRef(project);
  current.current = project;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const sounds = projectAudioClips(project);
  const report = (failure: unknown) =>
    setError(failure instanceof Error ? failure.message : String(failure));
  const commit = (next: Project) => {
    if (!mounted.current) return;
    const parsed = parseProject(next);
    onChange(parsed);
    current.current = parsed;
    setError("");
  };
  const changeSound = (id: string, changes: Partial<AudioClip>) => {
    try {
      commit({
        ...current.current,
        audioClips: projectAudioClips(current.current).map((clip) =>
          clip.id === id ? editSound(current.current, clip, changes) : clip,
        ),
      });
    } catch (failure) {
      report(failure);
    }
  };
  const addRecording = async (file: File, role: AudioClip["role"]) => {
    setBusy(true);
    setError("");
    try {
      const { asset } = await importMedia(file, platform);
      if (asset.kind !== "audio")
        throw new Error("Choose an audio recording or song");
      const previous = current.current;
      if (role === "music") {
        commit(placeNextSong(addAsset(previous, asset), asset));
        return;
      }
      const existing = projectAudioClips(previous);
      const start =
        role === "voiceover"
          ? time
          : existing
              .filter((clip) => clip.role === "music")
              .reduce(
                (end, clip) => Math.max(end, clip.start + clip.duration),
                0,
              );
      commit({
        ...addAsset(previous, asset),
        audioClips: [...existing, createAudioClip(asset, role, start)],
      });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Modal title="Sound & narration" onClose={onClose} className="sound-dialog">
      <p className="modal-introduction">
        Place songs and narration in your film. All times are seconds; anything
        beyond the film’s end is left out of export.
      </p>
      <fieldset disabled={busy} className="sound-controls">
        <div className="dialog-toolbar">
          <button
            className="button primary"
            onClick={() => input.current?.click()}
          >
            Add next song
          </button>
          <select
            aria-label="Add existing audio"
            value=""
            onChange={(event) => {
              const asset = project.assets[event.target.value];
              if (!asset) return;
              try {
                commit(placeNextSong(current.current, asset));
              } catch (failure) {
                report(failure);
              }
            }}
          >
            <option value="">Reuse a song or recording…</option>
            {Object.values(project.assets)
              .filter((asset) => asset.kind === "audio")
              .map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
          </select>
        </div>
        <VoiceRecorder
          report={report}
          onReady={(file) => addRecording(file, "voiceover")}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={project.duckMusic}
            onChange={(event) => {
              try {
                commit({ ...project, duckMusic: event.target.checked });
              } catch (failure) {
                report(failure);
              }
            }}
          />
          Lower music under clip sound and narration
        </label>
        <p className="dialog-note">
          Narration starts at the playhead ({time.toFixed(1)}s). Music is
          reduced throughout video clips with source sound enabled and
          narration, including their quiet sections.
        </p>
        {sounds.map((clip, index) => (
          <section
            key={clip.id}
            className="sound-row"
            aria-label={`Sound ${index + 1}`}
          >
            <h3>
              {index + 1}. {project.assets[clip.assetId].name}
            </h3>
            <div className="timing-fields">
              <label>
                Sound {index + 1} role
                <select
                  aria-label={`Sound ${index + 1} role`}
                  value={clip.role}
                  onChange={(event) =>
                    changeSound(clip.id, {
                      role: event.target.value as AudioClip["role"],
                    })
                  }
                >
                  <option value="music">Music</option>
                  <option value="voiceover">Narration</option>
                </select>
              </label>
              <TimingField
                label={`Sound ${index + 1} starts in film`}
                value={clip.start}
                onCommit={(start) => changeSound(clip.id, { start })}
              />
              <TimingField
                label={`Sound ${index + 1} starts in source`}
                value={clip.offset}
                onCommit={(offset) => changeSound(clip.id, { offset })}
              />
              <TimingField
                label={`Sound ${index + 1} duration`}
                value={clip.duration}
                min={0.1}
                onCommit={(duration) => changeSound(clip.id, { duration })}
              />
              <TimingField
                label={`Sound ${index + 1} volume %`}
                value={clip.volume * 100}
                max={400}
                step={1}
                onCommit={(volume) =>
                  changeSound(clip.id, { volume: volume / 100 })
                }
              />
              <TimingField
                label={`Sound ${index + 1} fade in`}
                value={clip.fadeIn}
                max={30}
                onCommit={(fadeIn) => changeSound(clip.id, { fadeIn })}
              />
              <TimingField
                label={`Sound ${index + 1} fade out`}
                value={clip.fadeOut}
                max={30}
                onCommit={(fadeOut) => changeSound(clip.id, { fadeOut })}
              />
            </div>
            <div className="dialog-toolbar">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={clip.loop}
                  onChange={(event) =>
                    changeSound(clip.id, { loop: event.target.checked })
                  }
                />
                Loop source within this duration
              </label>
              <button
                className="text-button"
                onClick={() => {
                  try {
                    commit({
                      ...project,
                      audioClips: sounds.filter(
                        (sound) => sound.id !== clip.id,
                      ),
                    });
                  } catch (failure) {
                    report(failure);
                  }
                }}
              >
                Remove sound {index + 1}
              </button>
            </div>
          </section>
        ))}
      </fieldset>
      <input
        ref={input}
        data-testid="sound-input"
        hidden
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void addRecording(file, "music").catch(report);
        }}
      />
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
