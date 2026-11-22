import { useT } from "../i18n/locale";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Music2, Plus, Type } from "lucide-react";
import { createPortal } from "react-dom";
import type { Project, Scene } from "../../contracts/project";
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
import { TransitionGlyph, TransitionTiles } from "./tools/Choices";
import { TRANSITION_CHOICES } from "./tools/choice-lists";
import { Slider } from "./tools/Fields";

/** Smallest and largest timeline scale, in pixels per second. */
const ZOOM_RANGE = { min: 4, max: 200 } as const;
/** Keep the transition picker clear of the viewport edges and its trigger. */
const POPOVER_GAP = 12;

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
  onTimelineMode: (timeline: boolean) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  platform: CortoPlatform;
  onAudioChange: (clips: Project["audioClips"]) => void;
  onSeek: (time: number) => void;
  /** Changes one scene by id (used by the seam transition picker). */
  onSceneChange: (id: string, changes: Partial<Scene>) => void;
  /** Applies a transition to every join in the film. */
  onAllTransitions: (transition: Scene["transition"], seconds: number) => void;
}

const transitionName = (transition: Scene["transition"]) =>
  TRANSITION_CHOICES.find(([id]) => id === transition)?.[1] ?? transition;

/** The join between two scenes, and the picker that opens from it. */
function Seam({
  scene,
  index,
  open,
  onOpen,
  onClose,
  onChange,
  onAll,
}: {
  scene: Scene;
  index: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (changes: Partial<Scene>) => void;
  onAll: () => void;
}) {
  const t = useT();
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(
    null,
  );
  // The reel scrolls sideways and clips its content, so the picker is placed
  // in viewport coordinates above the join, kept inside the window.
  useLayoutEffect(() => {
    const button = trigger.current;
    const picker = popover.current;
    if (!open || !button || !picker) return;
    const place = () => {
      const bounds = button.getBoundingClientRect();
      setAnchor({
        left: Math.max(
          POPOVER_GAP,
          Math.min(
            window.innerWidth - picker.offsetWidth - POPOVER_GAP,
            bounds.left + (bounds.width - picker.offsetWidth) / 2,
          ),
        ),
        top: Math.max(
          POPOVER_GAP,
          bounds.top - POPOVER_GAP - picker.offsetHeight,
        ),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(picker);
    const reel = button.closest(".reel-scroll");
    reel?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      reel?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [open]);
  const placed = !!anchor;
  useEffect(() => {
    // Focus only once placed: a hidden element cannot take focus.
    if (open && placed)
      popover.current
        ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        ?.focus({ preventScroll: true });
  }, [open, placed]);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (
        !popover.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose]);
  const label = `${t("Transition after scene ")}${index + 1}`;
  return (
    <span
      className={`seam ${open ? "open" : ""}`}
      data-transition={scene.transition}
    >
      <button
        ref={trigger}
        type="button"
        className={`seam-button ${scene.transition !== "cut" ? "has-transition" : ""}`}
        aria-label={`${label}: ${t(transitionName(scene.transition))}`}
        title={t(transitionName(scene.transition))}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={open ? onClose : onOpen}
      >
        <TransitionGlyph transition={scene.transition} size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popover}
            className="seam-popover"
            role="dialog"
            aria-label={label}
            style={anchor ?? { visibility: "hidden" }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
                trigger.current?.focus();
              }
            }}
          >
            <TransitionTiles
              value={scene.transition}
              onChange={(transition) => onChange({ transition })}
            />
            {scene.transition !== "cut" && (
              <Slider
                label={t("Transition duration")}
                value={scene.transitionSeconds}
                min={0}
                max={5}
                step={0.05}
                onChange={(transitionSeconds) =>
                  onChange({ transitionSeconds })
                }
              />
            )}
            <div className="seam-popover-actions">
              <button className="text-button" onClick={onAll}>
                {t("Use for every join")}
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  onClose();
                  trigger.current?.focus();
                }}
              >
                {t("Done")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

/** The bottom table: scenes in order, joins between them, sound beneath. */
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
  onTimelineMode,
  zoom,
  onZoom,
  platform,
  onAudioChange,
  onSeek,
  onSceneChange,
  onAllTransitions,
}: StoryboardProperties) {
  const t = useT();
  const [context, setContext] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [openSeam, setOpenSeam] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const timeline = useMemo(
    () => buildTimeline(project.scenes),
    [project.scenes],
  );
  const active = locateScene(timeline, time);
  const scrollId = playing ? active?.scene.id : selected;
  useEffect(() => {
    const container = strip.current?.closest<HTMLElement>(".reel-scroll");
    const card = scrollId
      ? container?.querySelector(`[data-scene-id="${CSS.escape(scrollId)}"]`)
      : null;
    if (!container || !card) return;
    const visible = container.getBoundingClientRect();
    const bounds = card.getBoundingClientRect();
    // Only the horizontal strip moves; scrollIntoView would also jump the whole page on mobile.
    if (bounds.left < visible.left)
      container.scrollLeft += bounds.left - visible.left - 24;
    else if (bounds.right > visible.right)
      container.scrollLeft += bounds.right - visible.right + 24;
  }, [scrollId, timelineMode]);
  const soundtrack = project.audioClips.find((clip) => clip.role === "music");
  const music = soundtrack ? project.assets[soundtrack.assetId] : null;
  const total = filmDuration(project.scenes);
  return (
    <section
      className={`storyboard ${timelineMode ? "timeline-mode" : ""}`}
      aria-label={t("Storyboard")}
      data-geo="storyboard"
    >
      <div className="reel-bar">
        <div
          className="segmented reel-view"
          role="group"
          aria-label={t("Reel view")}
        >
          <button
            type="button"
            aria-pressed={!timelineMode}
            onClick={() => onTimelineMode(false)}
          >
            {t("Storyboard")}
          </button>
          <button
            type="button"
            aria-pressed={timelineMode}
            onClick={() => onTimelineMode(true)}
          >
            {t("Timeline")}
          </button>
        </div>
        <span className="reel-summary">
          {project.scenes.length}{" "}
          {project.scenes.length === 1 ? t("scene") : t("scenes")}
          <span aria-hidden="true">{t(" · ")}</span>
          <span className="tabular">{formatTime(total)}</span>
          {selectedIds.size > 1 && (
            <span className="badge selection-badge">
              {selectedIds.size}
              {t(" selected")}
            </span>
          )}
        </span>
        <span className="header-spacer" />
        {timelineMode && (
          <label className="reel-zoom">
            <span className="sr-only">{t("Timeline zoom")}</span>
            <input
              type="range"
              aria-label={t("Timeline zoom")}
              min={ZOOM_RANGE.min}
              max={ZOOM_RANGE.max}
              value={zoom}
              style={
                {
                  "--progress": `${((zoom - ZOOM_RANGE.min) / (ZOOM_RANGE.max - ZOOM_RANGE.min)) * 100}%`,
                } as CSSProperties
              }
              onChange={(event) => onZoom(Number(event.target.value))}
            />
          </label>
        )}
        <button
          className="button quiet"
          aria-label={t("Add title card")}
          disabled={busy}
          onClick={onTitle}
        >
          <Type size={15} aria-hidden="true" />
          {t("Add title card")}
        </button>
      </div>
      <div className="reel-scroll">
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
            const isActive = active?.scene.id === scene.id;
            const isSelected = selectedIds.has(scene.id);
            const next = project.scenes[index + 1];
            return (
              <div
                className={`scene-slot ${dropTarget === scene.id ? "drop-target" : ""}`}
                key={scene.id}
                style={
                  timelineMode
                    ? {
                        width: Math.max(1, scene.duration * zoom),
                        marginLeft: index
                          ? -transitionOverlap(
                              project.scenes[index - 1],
                              scene,
                            ) * zoom
                          : 0,
                      }
                    : undefined
                }
              >
                <button
                  data-testid="scene-card"
                  data-scene-id={scene.id}
                  draggable={!busy}
                  className={`scene-card ${isSelected ? "selected" : ""} ${isActive ? "active-scene" : ""}`}
                  aria-label={t(
                    `Scene ${index + 1}: ${asset?.name ?? (scene.caption || "Title card")}`,
                  )}
                  aria-pressed={isSelected}
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
                      x: Math.min(window.innerWidth - 240, event.clientX),
                      y: Math.max(
                        8,
                        Math.min(window.innerHeight - 360, event.clientY - 300),
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
                    ) {
                      event.preventDefault();
                      setDropTarget(scene.id);
                    }
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(event) => {
                    setDropTarget(null);
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
                  <span
                    className={`scene-thumbnail ${!asset ? "title-thumbnail" : ""}`}
                    style={
                      !asset ? { background: scene.background } : undefined
                    }
                  >
                    {poster ? (
                      <img src={poster} alt="" draggable={false} />
                    ) : !asset ? (
                      <span className={`caption-${scene.captionStyle}`}>
                        {scene.caption || t("Title card")}
                      </span>
                    ) : (
                      <span className="thumbnail-placeholder" />
                    )}
                    <span className="scene-number">{index + 1}</span>
                    {scene.caption && asset && (
                      <span className="caption-indicator" title={scene.caption}>
                        <Type size={11} aria-hidden="true" />
                      </span>
                    )}
                    <span className="scene-duration">
                      {Number(scene.duration.toFixed(1))}
                      {t("s")}
                    </span>
                    {isActive && (
                      <span
                        className="scene-progress"
                        style={{
                          transform: `scaleX(${Math.max(0, Math.min(1, active.localTime / scene.duration))})`,
                        }}
                      />
                    )}
                  </span>
                  <span className="scene-name">
                    {asset?.name.replace(/\.[^.]+$/, "") ??
                      (scene.caption.split("\n")[0] || t("Title card"))}
                    {scene.group && (
                      <small className="scene-group">{scene.group}</small>
                    )}
                  </span>
                </button>
                {next && (
                  <Seam
                    scene={scene}
                    index={index}
                    open={openSeam === scene.id}
                    onOpen={() => setOpenSeam(scene.id)}
                    onClose={() => setOpenSeam(null)}
                    onChange={(changes) => onSceneChange(scene.id, changes)}
                    onAll={() =>
                      onAllTransitions(
                        scene.transition,
                        scene.transitionSeconds,
                      )
                    }
                  />
                )}
              </div>
            );
          })}
          {!project.scenes.length && (
            <div className="empty-storyboard">
              <div className="ghost-cards" aria-hidden="true">
                {[0, 1, 2, 3].map((slot) => (
                  <span className="ghost-card" key={slot} />
                ))}
              </div>
              <p className="empty-storyboard-text">
                {t("Scenes line up here. Each photo or clip becomes one; drag to change the order.")}
              </p>
            </div>
          )}
          {!!project.scenes.length && (
            <button
              className="add-scene-card"
              aria-label={t("Add another title card")}
              title={t("Add another title card")}
              onClick={onTitle}
              disabled={busy}
            >
              <Plus size={18} aria-hidden="true" />
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
          ref={(element) =>
            element
              ?.querySelector<HTMLElement>("[role=menuitem]")
              ?.focus({ preventScroll: true })
          }
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
        </div>
      )}
      {(!timelineMode || !project.audioClips.length) && (
        <div className="music-lane">
          <button
            className={
              music || project.audioClips.length
                ? "soundtrack-button has-music"
                : "soundtrack-button"
            }
            onClick={onMusic}
            disabled={busy}
          >
            <Music2 size={15} aria-hidden="true" />
            {project.audioClips.length > 1 ? (
              <>
                <span className="soundtrack-name">
                  {project.audioClips.length}
                  {t(" placed sounds")}
                </span>
                <small>{t("Music & narration")}</small>
              </>
            ) : music ? (
              <>
                <span className="soundtrack-name">
                  {music.name.replace(/\.[^.]+$/, "")}
                </span>
                <small>
                  {soundtrack?.followFilm && soundtrack.loop
                    ? t("Loops to fit")
                    : formatTime(music.duration)}
                </small>
              </>
            ) : (
              <span className="soundtrack-name">{t("Add a soundtrack")}</span>
            )}
            <span className="music-pattern" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
});
