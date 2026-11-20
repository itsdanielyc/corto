import { useT } from "../i18n/locale";
import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { ImagePlus, Maximize2, SkipBack, SkipForward } from "lucide-react";
import type { Project } from "../../contracts/project";
import { buildTimeline, formatTime } from "../domain/timeline";
import type { MediaResources } from "../hooks/use-resources";
import type { CortoPlatform } from "../platform/types";
import { IconButton } from "./primitives";
import { Preview } from "./Preview";
import { CortoMark, PlayMark } from "./PlayMark";

export const RATIO_CHOICES: readonly (readonly [Project["ratio"], string])[] = [
  ["landscape", "16:9 · Landscape"],
  ["portrait", "9:16 · Portrait"],
  ["square", "1:1 · Square"],
  ["classic", "4:3 · Classic"],
  ["feed", "4:5 · Social feed"],
  ["cinema", "2.35:1 · Cinema"],
];

interface StageProperties {
  project: Project;
  platform: CortoPlatform;
  resources: MediaResources;
  preferProxies: boolean;
  time: number;
  total: number;
  playing: boolean;
  busy: boolean;
  onTime: (time: number) => void;
  onPlaying: (playing: boolean) => void;
  onTogglePlayback: () => void;
  onStep: (direction: number) => void;
  onRatio: (ratio: Project["ratio"]) => void;
  onImport: () => void;
  onExample: () => void;
  report: (error: unknown) => void;
  /** Editing handles drawn over the picture (words, framing). */
  overlay?: ReactNode;
}

/**
 * Scene-segmented scrubber. Each segment spans from a scene's start to the
 * next scene's start, so transition overlaps never double-count. O(n) per
 * render for n scenes.
 */
function Scrubber({
  project,
  time,
  total,
  onSeek,
}: {
  project: Project;
  time: number;
  total: number;
  onSeek: (time: number) => void;
}) {
  const t = useT();
  const segments = useMemo(() => {
    const timeline = buildTimeline(project.scenes);
    return timeline.map((entry, index) => {
      const end = timeline[index + 1]?.start ?? total;
      return { id: entry.scene.id, start: entry.start, span: end - entry.start };
    });
  }, [project.scenes, total]);
  const progress = total ? Math.min(1, time / total) : 0;
  return (
    <div className="scrubber">
      <div className="scrubber-track" aria-hidden="true">
        {segments.map((segment) => (
          <span
            key={segment.id}
            className="scrubber-segment"
            style={{ flexGrow: Math.max(0.001, segment.span) }}
          >
            <i
              style={{
                transform: `scaleX(${segment.span ? Math.max(0, Math.min(1, (time - segment.start) / segment.span)) : 0})`,
              }}
            />
          </span>
        ))}
      </div>
      <span
        className="scrubber-thumb"
        aria-hidden="true"
        style={{ left: `${progress * 100}%` }}
      />
      <input
        className="playhead"
        aria-label={t("Playhead")}
        aria-valuetext={`${formatTime(time)} / ${formatTime(total)}`}
        type="range"
        min="0"
        max={total || 1}
        step="0.01"
        value={time}
        disabled={!project.scenes.length}
        onChange={(event) => onSeek(Number(event.target.value))}
        style={{ "--progress": `${progress * 100}%` } as CSSProperties}
      />
    </div>
  );
}

/** First launch: the stage itself invites the first photos. */
function EmptyStage({
  busy,
  onImport,
  onExample,
}: Pick<StageProperties, "busy" | "onImport" | "onExample">) {
  const t = useT();
  return (
    <div className="empty-stage">
      <CortoMark className="empty-stage-mark" />
      <h1>{t("Make something worth keeping.")}</h1>
      <p>{t("Drop photos, clips and music anywhere in the window.")}</p>
      <div className="empty-stage-actions">
        <button
          className="button primary stage-primary"
          disabled={busy}
          onClick={onImport}
        >
          <ImagePlus size={16} aria-hidden="true" />
          {t("Bring in your moments")}
        </button>
        <button
          className="button stage-secondary"
          disabled={busy}
          onClick={onExample}
        >
          {t("Try an example")}
        </button>
      </div>
    </div>
  );
}

/** The dark screen in the middle: the film, how to play it, where you are. */
export function Stage(properties: StageProperties) {
  const t = useT();
  const screen = useRef<HTMLDivElement>(null);
  const { project, time, total, playing } = properties;
  const empty = !project.scenes.length;
  return (
    <main className="stage" aria-label={t("Film editor")} data-empty={empty}>
      <div className="stage-screen" ref={screen}>
        {empty ? (
          <EmptyStage
            busy={properties.busy}
            onImport={properties.onImport}
            onExample={properties.onExample}
          />
        ) : (
          <div className="stage-picture">
            <Preview
              preferProxies={properties.preferProxies}
              project={project}
              platform={properties.platform}
              resources={properties.resources}
              time={time}
              playing={playing}
              onTime={properties.onTime}
              onPlaying={properties.onPlaying}
              report={properties.report}
            />
            {properties.overlay}
          </div>
        )}
      </div>
      <div className="stage-controls" hidden={empty}>
        <Scrubber
          project={project}
          time={time}
          total={total}
          onSeek={(at) => {
            properties.onPlaying(false);
            properties.onTime(at);
          }}
        />
        <div className="transport">
          <span className="time-code">
            <strong>{formatTime(time)}</strong>
            <span aria-hidden="true">{t(" / ")}</span>
            <span className="sr-only">{t(" of ")}</span>
            {formatTime(total)}
          </span>
          <div className="transport-buttons">
            <IconButton
              icon={SkipBack}
              label={t("Previous scene")}
              className="stage-button"
              disabled={empty}
              onClick={() => properties.onStep(-1)}
            />
            <button
              type="button"
              className="play-button"
              aria-label={t(playing ? "Pause" : "Play")}
              title={`${t(playing ? "Pause" : "Play")} (Space)`}
              disabled={empty}
              onClick={properties.onTogglePlayback}
            >
              <PlayMark playing={playing} />
            </button>
            <IconButton
              icon={SkipForward}
              label={t("Next scene")}
              className="stage-button"
              disabled={empty}
              onClick={() => properties.onStep(1)}
            />
          </div>
          <div className="transport-end">
            <label className="aspect-select">
              <span className="sr-only">{t("Aspect ratio")}</span>
              {/* The closed control shows only the ratio; the menu names each shape. */}
              <span className="aspect-value" aria-hidden="true">
                {RATIO_CHOICES.find(([value]) => value === project.ratio)?.[1]
                  .split(" · ")[0] ?? project.ratio}
              </span>
              <select
                aria-label={t("Aspect ratio")}
                value={project.ratio}
                onChange={(event) =>
                  properties.onRatio(event.target.value as Project["ratio"])
                }
              >
                {RATIO_CHOICES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <IconButton
              icon={Maximize2}
              label={t("Full screen preview")}
              className="stage-button"
              disabled={empty}
              onClick={() => {
                void screen.current
                  ?.requestFullscreen()
                  .catch(properties.report);
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
