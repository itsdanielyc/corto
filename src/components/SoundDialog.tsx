import { useT } from "../i18n/locale";
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
import { Panel } from "./primitives";
import { TimingField } from "./TimingField";
import { VoiceRecorder } from "./VoiceRecorder";
import { SoundPack } from "./SoundPack";
import { Waveform } from "./Waveform";
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
  const t = useT();
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
  const addRecording = async (
    file: File,
    role: AudioClip["role"],
    effect = false,
  ) => {
    setBusy(true);
    setError("");
    try {
      const { asset } = await importMedia(file, platform);
      if (asset.kind !== "audio")
        throw new Error("Choose an audio recording or song");
      const previous = current.current;
      if (role === "music" && !effect) {
        commit(placeNextSong(addAsset(previous, asset), asset));
        return;
      }
      const existing = projectAudioClips(previous);
      const start =
        role === "voiceover" || effect
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
  const cleanSound = async (
    clip: AudioClip,
    operation: "denoise" | "normalize",
  ) => {
    if (!platform.processMedia) return;
    setBusy(true);
    try {
      const original = current.current.assets[clip.assetId];
      const duration = clip.loop
        ? original.duration - clip.offset
        : clip.duration;
      const result = await platform.processMedia(current.current, {
        assetId: clip.assetId,
        operation,
        start: clip.offset,
        duration,
        threshold: 0.3,
        speed: 1,
        preservePitch: true,
      });
      if (!result.media || !mounted.current) return;
      const asset = result.media.asset;
      commit({
        ...addAsset(current.current, asset),
        audioClips: projectAudioClips(current.current).map((sound) =>
          sound.id === clip.id
            ? { ...sound, assetId: asset.id, offset: 0 }
            : sound,
        ),
      });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Panel
      title={t("Sound & narration")}
      onClose={onClose}
      className="sound-dialog"
    >
      <p className="modal-introduction">
        {t("Times are in seconds. Sound past the end of the film is left out.")}
      </p>
      <fieldset disabled={busy} className="sound-controls">
        <SoundPack
          disabled={busy}
          onAdd={(file, effect) => addRecording(file, "music", effect)}
        />
        <div className="dialog-toolbar">
          <button
            className="button secondary"
            onClick={() => input.current?.click()}
          >
            {t("Add next song")}
          </button>
          <select
            aria-label={t("Add existing audio")}
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
            <option value="">{t("Reuse a song or recording\u2026")}</option>
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
          {t("Lower music under clip sound and narration")}
        </label>
        <p className="dialog-note">
          {t("Narration starts at the playhead (")}
          {time.toFixed(1)}
          {t(
            "s). Music is reduced throughout video clips with source sound enabled and narration, including their quiet sections.",
          )}
        </p>
        {sounds.map((clip, index) => (
          <section
            key={clip.id}
            className="sound-row"
            aria-label={t(`Sound ${index + 1}`)}
          >
            <h3>
              {index + 1}
              {t(". ")}
              {project.assets[clip.assetId].name}
            </h3>
            <div className="timing-fields">
              <label>
                {t("Sound ")}
                {index + 1}
                {t(" role")}
                <select
                  aria-label={t(`Sound ${index + 1} role`)}
                  value={clip.role}
                  onChange={(event) =>
                    changeSound(clip.id, {
                      role: event.target.value as AudioClip["role"],
                    })
                  }
                >
                  <option value="music">{t("Music")}</option>
                  <option value="voiceover">{t("Narration")}</option>
                </select>
              </label>
              <TimingField
                label={t(`Sound ${index + 1} starts in film`)}
                value={clip.start}
                onCommit={(start) => changeSound(clip.id, { start })}
              />
              <TimingField
                label={t(`Sound ${index + 1} starts in source`)}
                value={clip.offset}
                onCommit={(offset) => changeSound(clip.id, { offset })}
              />
              <TimingField
                label={t(`Sound ${index + 1} duration`)}
                value={clip.duration}
                min={0.1}
                onCommit={(duration) => changeSound(clip.id, { duration })}
              />
              <TimingField
                label={t(`Sound ${index + 1} volume %`)}
                value={clip.volume * 100}
                max={400}
                step={1}
                onCommit={(volume) =>
                  changeSound(clip.id, { volume: volume / 100 })
                }
              />
              <TimingField
                label={t(`Sound ${index + 1} fade in`)}
                value={clip.fadeIn}
                max={30}
                onCommit={(fadeIn) => changeSound(clip.id, { fadeIn })}
              />
              <TimingField
                label={t(`Sound ${index + 1} fade out`)}
                value={clip.fadeOut}
                max={30}
                onCommit={(fadeOut) => changeSound(clip.id, { fadeOut })}
              />
            </div>
            <Waveform
              project={project}
              assetId={clip.assetId}
              platform={platform}
            />
            <div className="dialog-toolbar">
              <button
                className="text-button"
                onClick={() => {
                  void cleanSound(clip, "denoise").catch(report);
                }}
              >
                {t("Reduce noise in sound ")}
                {index + 1}
              </button>
              <button
                className="text-button"
                onClick={() => {
                  void cleanSound(clip, "normalize").catch(report);
                }}
              >
                {t("Normalize sound ")}
                {index + 1}
              </button>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={clip.loop}
                  onChange={(event) =>
                    changeSound(clip.id, { loop: event.target.checked })
                  }
                />
                {t("Loop source within this duration")}
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
                {t("Remove sound ")}
                {index + 1}
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
    </Panel>
  );
}
