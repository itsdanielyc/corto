import { useT } from "../i18n/locale";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, ListVideo, Music2, Plus, Type } from "lucide-react";
import type { Project } from "../../contracts/project";
import {
  buildTimeline,
  filmDuration,
  formatTime,
  locateScene,
} from "../domain/timeline";
import type { MediaResources } from "../hooks/use-resources";
import type { CortoPlatform } from "../platform/types";
import { SoundLanes } from "./SoundLanes";
import { TimelineRuler } from "./TimelineRuler";
import { transitionOverlap } from "../domain/composition";
interface StoryboardProperties {
  project: Project;
  resources: MediaResources;
  selected: string | null;
  time: number;
  playing: boolean;
  onSelect: (
    id: string,
    options?: {
      additive?: boolean;
      range?: boolean;
    },
  ) => void;
  onReorder: (id: string, index: number) => void;
  onTitle: () => void;
  onMusic: () => void;
  busy: boolean;
  selectedIds: ReadonlySet<string>;
  onAction: (action: string) => void;
  onAddAsset: (id: string, afterId: string) => void;
  timelineMode: boolean;
  zoom: number;
  platform: CortoPlatform;
  onAudioChange: (clips: Project["audioClips"]) => void;
  onSeek: (time: number) => void;
}
export const Storyboard = memo(function Storyboard({
  project,
  resources,
  selected,
  time,
  playing,
  onSelect,
  onReorder,
  onTitle,
  onMusic,
  busy,
  selectedIds,
  onAction,
  onAddAsset,
  timelineMode,
  zoom,
  platform,
  onAudioChange,
  onSeek,
}: StoryboardProperties) {
  const t = useT();
  const [context, setContext] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const timeline = useMemo(
    () => buildTimeline(project.scenes),
    [project.scenes],
  );
  const active = locateScene(timeline, time);
  const scrollId = playing ? active?.scene.id : selected;
  useEffect(() => {
    const container = timelineMode
      ? strip.current?.parentElement
      : strip.current;
    const card = scrollId
      ? container?.querySelector(`[data-scene-id="${CSS.escape(scrollId)}"]`)
      : null;
    if (!container || !card) return;
    const visible = container.getBoundingClientRect();
    const selected = card.getBoundingClientRect();
    // Only the horizontal strip moves; scrollIntoView would also jump the whole page on mobile.
    if (selected.left < visible.left)
      container.scrollLeft += selected.left - visible.left - 2;
    else if (selected.right > visible.right)
      container.scrollLeft += selected.right - visible.right + 2;
  }, [scrollId, timelineMode]);
  const soundtrack = project.audioClips.find((clip) => clip.role === "music");
  const music = soundtrack ? project.assets[soundtrack.assetId] : null;
  return (
    <section
      className="storyboard"
      aria-label={t("Storyboard")}
      data-geo="storyboard"
    >
      <div className="storyboard-heading">
        <h2>
          <ListVideo size={16} />
          {t("Your storyboard")}
          <span>
            {project.scenes.length}{" "}
            {project.scenes.length === 1 ? t("scene") : t("scenes")}
            <b>{t("\u00B7")}</b>
            {formatTime(filmDuration(project.scenes))}
          </span>
        </h2>
        <button
          className="text-button"
          aria-label={t("Add title card")}
          disabled={busy}
          onClick={onTitle}
        >
          <Type size={14} />
          {t("Add title card")}
          <Plus size={14} />
        </button>
      </div>
      <div className={timelineMode ? "timeline-scroll" : "storyboard-content"}>
        {timelineMode && project.scenes.length > 0 && (
          <TimelineRuler
            project={project}
            zoom={zoom}
            time={time}
            onSeek={onSeek}
          />
        )}
        <div
          className={`storyboard-strip ${timelineMode ? "proportional-timeline" : ""}`}
          ref={strip}
        >
          {project.scenes.map((scene, index) => {
            const asset = scene.assetId ? project.assets[scene.assetId] : null;
            const poster = asset ? resources[asset.id]?.poster : null;
            return (
              <button
                key={scene.id}
                data-testid="scene-card"
                data-scene-id={scene.id}
                draggable={!busy}
                className={`scene-card ${selectedIds.has(scene.id) ? "selected" : ""} ${active?.scene.id === scene.id ? "active-scene" : ""}`}
                style={
                  timelineMode
                    ? {
                        width: Math.max(1, scene.duration * zoom),
                        minWidth: Math.max(1, scene.duration * zoom),
                        marginLeft: index
                          ? -transitionOverlap(
                              project.scenes[index - 1],
                              scene,
                            ) * zoom
                          : 0,
                      }
                    : undefined
                }
                aria-label={t(
                  `Scene ${index + 1}: ${asset?.name ?? (scene.caption || "Title card")}`,
                )}
                aria-pressed={selectedIds.has(scene.id)}
                onClick={(event) =>
                  onSelect(scene.id, {
                    additive: event.ctrlKey || event.metaKey,
                    range: event.shiftKey,
                  })
                }
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (!selectedIds.has(scene.id)) onSelect(scene.id);
                  setContext({
                    x: Math.min(window.innerWidth - 210, event.clientX),
                    y: Math.max(
                      8,
                      Math.min(window.innerHeight - 350, event.clientY),
                    ),
                  });
                }}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/x-corto-scene",
                    scene.id,
                  );
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (
                    event.dataTransfer.types.includes(
                      "application/x-corto-scene",
                    ) ||
                    event.dataTransfer.types.includes(
                      "application/x-corto-asset",
                    )
                  )
                    event.preventDefault();
                }}
                onDrop={(event) => {
                  const assetId = event.dataTransfer.getData(
                    "application/x-corto-asset",
                  );
                  if (assetId) {
                    event.preventDefault();
                    event.stopPropagation();
                    onAddAsset(assetId, scene.id);
                    return;
                  }
                  const id = event.dataTransfer.getData(
                    "application/x-corto-scene",
                  );
                  if (id) {
                    event.preventDefault();
                    event.stopPropagation();
                    onReorder(id, index);
                  }
                }}
              >
                <div className="scene-number">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {timelineMode && (
                    <small>{formatTime(timeline[index].start)}</small>
                  )}
                  <GripVertical size={12} />
                </div>
                <div
                  className={`scene-thumbnail ${!asset ? "title-thumbnail" : ""}`}
                  style={!asset ? { background: scene.background } : undefined}
                >
                  {poster ? (
                    <img src={poster} alt="" />
                  ) : !asset ? (
                    <span className={`caption-${scene.captionStyle}`}>
                      {scene.caption || t("Title card")}
                    </span>
                  ) : (
                    <span className="thumbnail-placeholder" />
                  )}
                  {scene.caption && asset && (
                    <span className="caption-indicator">
                      <Type size={11} />
                    </span>
                  )}
                  <span className="scene-duration">
                    {Number(scene.duration.toFixed(2))}
                    {t("s")}
                  </span>
                  {active?.scene.id === scene.id && (
                    <span
                      className="scene-progress"
                      style={{
                        width: `${Math.max(0, Math.min(100, (active.localTime / scene.duration) * 100))}%`,
                      }}
                    />
                  )}
                </div>
                <span className="scene-name">
                  {asset?.name.replace(/\.[^.]+$/, "") ?? t("Title card")}
                  {scene.group && (
                    <small className="scene-group">{scene.group}</small>
                  )}
                </span>
              </button>
            );
          })}
          {!project.scenes.length && (
            <div className="empty-storyboard">
              <span className="empty-scene">
                <Plus size={20} />
              </span>
              <div>
                <strong>{t("One moment after another.")}</strong>
                <p>
                  {t("Import media to begin. Drag scenes to find your story.")}
                </p>
              </div>
            </div>
          )}
          {!!project.scenes.length && (
            <button
              className="add-scene-card"
              aria-label={t("Add another title card")}
              onClick={onTitle}
              disabled={busy}
            >
              <Plus size={20} />
              <span>{t("Title card")}</span>
            </button>
          )}
        </div>
        {timelineMode && project.audioClips.length > 0 && (
          <SoundLanes
            project={project}
            platform={platform}
            zoom={zoom}
            onChange={onAudioChange}
            onEdit={onMusic}
          />
        )}
      </div>
      {context && (
        <div
          className="scene-context-menu"
          role="menu"
          aria-label={t("Scene actions")}
          style={{ left: context.x, top: context.y }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setContext(null);
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setContext(null);
          }}
        >
          {[
            ["copy", "Copy scenes"],
            ["cut", "Cut scenes"],
            ["paste", "Paste scenes after selection"],
            ["duplicate", "Duplicate selection"],
            ["split", "Split scene at playhead"],
            ["copy-effects", "Copy scene effects"],
            ["paste-effects", "Paste scene effects"],
            ["delete", "Delete selection"],
          ].map(([action, label]) => (
            <button
              role="menuitem"
              key={action}
              onClick={() => {
                onAction(action);
                setContext(null);
              }}
            >
              {t(label)}
            </button>
          ))}
          <button role="menuitem" onClick={() => setContext(null)}>
            {t("Close menu")}
          </button>
        </div>
      )}
      {(!timelineMode || !project.audioClips.length) && (
        <div className="music-lane">
          <Music2 size={15} />
          <button
            className={
              music || project.audioClips.length
                ? "soundtrack-button has-music"
                : "soundtrack-button"
            }
            onClick={onMusic}
            disabled={busy}
          >
            {project.audioClips.length > 1 ? (
              <>
                <span className="music-pattern" aria-hidden="true" />
                <span>
                  {project.audioClips.length}
                  {t(" placed sounds")}
                </span>
                <small>{t("Music & narration")}</small>
              </>
            ) : music ? (
              <>
                <span className="music-pattern" aria-hidden="true" />
                <span>{music.name.replace(/\.[^.]+$/, "")}</span>
                <small>
                  {soundtrack?.followFilm && soundtrack.loop
                    ? t("Loops to fit")
                    : formatTime(music.duration)}
                </small>
              </>
            ) : (
              <>
                <Plus size={13} />
                {t("Add a soundtrack")}
                <span>{t("Bring the feeling.")}</span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
});
