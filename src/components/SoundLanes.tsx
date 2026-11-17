import { useT } from "../i18n/locale";
import { useMemo, useRef } from "react";
import type { AudioClip, Project } from "../../contracts/project";
import { LIMITS } from "../../contracts/project";
import { projectAudioClips } from "../domain/audio";
import { packSoundLanes } from "../domain/sound-analysis";
import { filmDuration } from "../domain/timeline";
import type { CortoPlatform } from "../platform/types";
import { Waveform } from "./Waveform";
/** Move measured sound blocks on the same time scale as the optional proportional picture timeline. */
export function SoundLanes({
  project,
  platform,
  zoom,
  onChange,
  onEdit,
}: {
  project: Project;
  platform: CortoPlatform;
  zoom: number;
  onChange: (clips: AudioClip[]) => void;
  onEdit: () => void;
}) {
  const t = useT();
  const clips = useMemo(() => projectAudioClips(project), [project]);
  const placed = useMemo(() => packSoundLanes(clips), [clips]);
  const drag = useRef<{
    id: string;
    x: number;
    start: number;
  } | null>(null);
  const lanes = Math.max(1, ...placed.map((item) => item.lane + 1));
  const seconds = Math.max(
    filmDuration(project.scenes),
    ...clips.map((clip) => clip.start + clip.duration),
  );
  return (
    <div className="sound-lanes-scroll" aria-label={t("Sound timeline")}>
      <div
        className="sound-lanes"
        style={{ width: Math.max(400, seconds * zoom), height: lanes * 42 }}
      >
        {placed.map(({ clip, lane }) => (
          <button
            key={clip.id}
            className={`sound-block ${clip.role}`}
            aria-label={t(
              `Edit ${project.assets[clip.assetId].name} at ${clip.start.toFixed(2)} seconds`,
            )}
            style={{
              left: clip.start * zoom,
              top: lane * 42,
              width: Math.max(4, clip.duration * zoom),
            }}
            onDoubleClick={onEdit}
            onPointerDown={(event) => {
              drag.current = {
                id: clip.id,
                x: event.clientX,
                start: clip.start,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
              const initial = drag.current;
              drag.current = null;
              if (!initial || initial.id !== clip.id) return;
              const delta = (event.clientX - initial.x) / zoom;
              if (Math.abs(delta) < 0.05) {
                onEdit();
                return;
              }
              const start = Math.max(
                0,
                Math.min(
                  LIMITS.filmSeconds - clip.duration,
                  initial.start + delta,
                ),
              );
              onChange(
                clips.map((item) =>
                  item.id === clip.id ? { ...item, start } : item,
                ),
              );
            }}
          >
            <Waveform
              project={project}
              assetId={clip.assetId}
              platform={platform}
            />
            <span>{project.assets[clip.assetId].name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
