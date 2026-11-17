import { memo, useEffect, useRef, useState } from "react";
import { GripVertical, ListVideo, Music2, Plus, Type } from "lucide-react";
import type { Project } from "../../contracts/project";
import {
  buildTimeline,
  filmDuration,
  formatTime,
  locateScene,
} from "../domain/timeline";
import type { MediaResources } from "../hooks/use-resources";

interface StoryboardProperties {
  project: Project;
  resources: MediaResources;
  selected: string | null;
  time: number;
  playing: boolean;
  onSelect: (
    id: string,
    options?: { additive?: boolean; range?: boolean },
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
}: StoryboardProperties) {
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const timeline = buildTimeline(project.scenes);
  const active = locateScene(timeline, time);
  const scrollId = playing ? active?.scene.id : selected;
  useEffect(() => {
    const container = strip.current;
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
  }, [scrollId]);
  const soundtrack = project.audioClips.find((clip) => clip.role === "music");
  const music = soundtrack ? project.assets[soundtrack.assetId] : null;
  return (
    <section
      className="storyboard"
      aria-label="Storyboard"
      data-geo="storyboard"
    >
      <div className="storyboard-heading">
        <h2>
          <ListVideo size={16} />
          Your storyboard
          <span>
            {project.scenes.length}{" "}
            {project.scenes.length === 1 ? "scene" : "scenes"}
            <b>·</b>
            {formatTime(filmDuration(project.scenes))}
          </span>
        </h2>
        <button
          className="text-button"
          aria-label="Add title card"
          disabled={busy}
          onClick={onTitle}
        >
          <Type size={14} />
          Add title card
          <Plus size={14} />
        </button>
      </div>
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
                      width: Math.max(48, scene.duration * zoom),
                      minWidth: Math.max(48, scene.duration * zoom),
                    }
                  : undefined
              }
              aria-label={`Scene ${index + 1}: ${asset?.name ?? (scene.caption || "Title card")}`}
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
                  event.dataTransfer.types.includes("application/x-corto-asset")
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
                    {scene.caption || "Title card"}
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
                  {Number(scene.duration.toFixed(2))}s
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
                {asset?.name.replace(/\.[^.]+$/, "") ?? "Title card"}
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
              <strong>One moment after another.</strong>
              <p>Import media to begin. Drag scenes to find your story.</p>
            </div>
          </div>
        )}
        {!!project.scenes.length && (
          <button
            className="add-scene-card"
            aria-label="Add another title card"
            onClick={onTitle}
            disabled={busy}
          >
            <Plus size={20} />
            <span>Title card</span>
          </button>
        )}
      </div>
      {context && (
        <div
          className="scene-context-menu"
          role="menu"
          aria-label="Scene actions"
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
              {label}
            </button>
          ))}
          <button role="menuitem" onClick={() => setContext(null)}>
            Close menu
          </button>
        </div>
      )}
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
              <span>{project.audioClips.length} placed sounds</span>
              <small>Music &amp; narration</small>
            </>
          ) : music ? (
            <>
              <span className="music-pattern" aria-hidden="true" />
              <span>{music.name.replace(/\.[^.]+$/, "")}</span>
              <small>
                {soundtrack?.followFilm && soundtrack.loop
                  ? "Loops to fit"
                  : formatTime(music.duration)}
              </small>
            </>
          ) : (
            <>
              <Plus size={13} />
              Add a soundtrack<span>Bring the feeling.</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
});
