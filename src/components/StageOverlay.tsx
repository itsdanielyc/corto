import { useT } from "../i18n/locale";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowLeftRight, Check } from "lucide-react";
import type { Project, Scene, TextItem } from "../../contracts/project";
import { buildTimeline, frameDimensions } from "../domain/timeline";
import { cameraEndpoints, type CameraPose } from "../domain/composition";
import { layoutText } from "../preview/text";
import type { CortoPlatform } from "../platform/types";

/** Distance (fraction of the frame) within which words snap to the centre lines. */
const SNAP = 0.02;
/** Keyboard nudges: arrow keys move 1%, Shift+arrow 5%. */
const NUDGE = 0.01;
const NUDGE_LARGE = 0.05;
/** The camera never zooms beyond what the export allows. */
const ZOOM_LIMITS = { min: 1, max: 6 } as const;

type Box = { left: number; top: number; width: number; height: number };

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

/** Tracks an element's box relative to a container, following resizes. */
function useRelativeBox(
  container: React.RefObject<HTMLElement | null>,
  find: () => Element | null,
) {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const root = container.current;
    const target = find();
    if (!root || !target) return;
    const measure = () => {
      const outer = root.getBoundingClientRect();
      const inner = target.getBoundingClientRect();
      setBox({
        left: inner.left - outer.left,
        top: inner.top - outer.top,
        width: inner.width,
        height: inner.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(target);
    return () => observer.disconnect();
  }, [container, find]);
  return box;
}

/* ---------------------------------------------------------------- words */

/** Text-item boxes in frame fractions, laid out exactly as the renderer does. */
function textBoxes(project: Project, items: readonly TextItem[]) {
  const { width, height } = frameDimensions(project.ratio, "720p");
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return [];
  return items.map((item) => {
    const layout = layoutText(context, item, width, height);
    return {
      item,
      width: layout.width / width,
      height: layout.height / height,
    };
  });
}

function WordsLayer({
  project,
  scene,
  localTime,
  frame,
  onChange,
}: {
  project: Project;
  scene: Scene;
  localTime: number;
  frame: Box;
  onChange: (changes: Partial<Scene>) => void;
}) {
  const t = useT();
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    snapX: boolean;
    snapY: boolean;
  } | null>(null);
  const start = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const visible = scene.textItems.filter(
    (item) =>
      item.text &&
      item.animation !== "credits" &&
      localTime >= item.start &&
      localTime < (item.end ?? scene.duration),
  );
  const boxes = useMemo(
    () => textBoxes(project, visible),
    // Text geometry depends only on the visible items and the frame shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.ratio, JSON.stringify(visible)],
  );
  const move = (id: string, x: number, y: number) =>
    onChange({
      textItems: scene.textItems.map((item) =>
        item.id === id ? { ...item, x, y } : item,
      ),
    });
  const position = (
    event: ReactPointerEvent<HTMLElement>,
  ): { x: number; y: number; snapX: boolean; snapY: boolean } | null => {
    if (!start.current) return null;
    let x = clamp(
      start.current.x + (event.clientX - start.current.pointerX) / frame.width,
      0,
      1,
    );
    let y = clamp(
      start.current.y + (event.clientY - start.current.pointerY) / frame.height,
      0,
      1,
    );
    const snapX = Math.abs(x - 0.5) < SNAP;
    const snapY = Math.abs(y - 0.5) < SNAP;
    if (snapX) x = 0.5;
    if (snapY) y = 0.5;
    return { x, y, snapX, snapY };
  };
  const keyboard = (event: ReactKeyboardEvent, item: TextItem) => {
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (!(event.key in delta)) return;
    event.preventDefault();
    event.stopPropagation();
    const [dx, dy] = delta[event.key];
    move(item.id, clamp(item.x + dx, 0, 1), clamp(item.y + dy, 0, 1));
  };
  return (
    <div
      className="words-layer"
      style={{
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      }}
    >
      {drag?.snapX && <span className="snap-guide vertical" />}
      {drag?.snapY && <span className="snap-guide horizontal" />}
      {(drag?.snapX || drag?.snapY) && (
        <span className="snap-label">{t("Centred")}</span>
      )}
      {boxes.map(({ item, width, height }) => {
        const x = drag?.id === item.id ? drag.x : item.x;
        const y = drag?.id === item.id ? drag.y : item.y;
        return (
          <button
            key={item.id}
            type="button"
            className={`words-handle ${drag?.id === item.id ? "dragging" : ""}`}
            aria-label={`${t("Move words")}: ${item.text}`}
            title={t("Drag to move. Arrow keys nudge.")}
            style={{
              left: `${(x - width / 2) * 100}%`,
              top: `${(y - height / 2) * 100}%`,
              width: `${width * 100}%`,
              height: `${height * 100}%`,
            }}
            onKeyDown={(event) => keyboard(event, item)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              start.current = {
                pointerX: event.clientX,
                pointerY: event.clientY,
                x: item.x,
                y: item.y,
              };
              setDrag({ id: item.id, x: item.x, y: item.y, snapX: false, snapY: false });
            }}
            onPointerMove={(event) => {
              const next = position(event);
              if (next) setDrag({ id: item.id, ...next });
            }}
            onPointerUp={(event) => {
              const next = position(event);
              start.current = null;
              setDrag(null);
              if (next && (next.x !== item.x || next.y !== item.y))
                move(item.id, next.x, next.y);
            }}
            onPointerCancel={() => {
              start.current = null;
              setDrag(null);
            }}
          >
            {drag?.id === item.id && (
              <span className="words-ghost">{item.text}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- framing */

/** A camera pose as a rectangle in fractions of the oriented photo. */
interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts between camera poses (focus + zoom, see mediaPlacement) and the
 * rectangle of the photo they show. Frame fraction at zoom 1 is
 * target / (photo × cover scale); focus is the share of the spare space
 * left of (or above) the frame.
 */
function frameGeometry(
  photoWidth: number,
  photoHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: Scene["fit"],
) {
  const scale = (fit === "cover" ? Math.max : Math.min)(
    targetWidth / photoWidth,
    targetHeight / photoHeight,
  );
  const baseWidth = targetWidth / (photoWidth * scale);
  const baseHeight = targetHeight / (photoHeight * scale);
  const toRect = (pose: CameraPose): FrameRect => {
    const width = baseWidth / pose.zoom;
    const height = baseHeight / pose.zoom;
    return {
      width,
      height,
      left: (1 - width) * pose.focusX,
      top: (1 - height) * pose.focusY,
    };
  };
  const toPose = (rect: FrameRect): CameraPose => ({
    zoom: clamp(baseWidth / rect.width, ZOOM_LIMITS.min, ZOOM_LIMITS.max),
    focusX: rect.width < 1 ? clamp(rect.left / (1 - rect.width), 0, 1) : 0.5,
    focusY: rect.height < 1 ? clamp(rect.top / (1 - rect.height), 0, 1) : 0.5,
  });
  return { toRect, toPose };
}

function FramingLayer({
  project,
  scene,
  platform,
  area,
  onChange,
  onDone,
}: {
  project: Project;
  scene: Scene;
  platform: CortoPlatform;
  area: Box;
  onChange: (changes: Partial<Scene>) => void;
  onDone: () => void;
}) {
  const t = useT();
  const asset = scene.assetId ? project.assets[scene.assetId] : null;
  const [end, setEnd] = useState<"from" | "to">("from");
  const [live, setLive] = useState<FrameRect | null>(null);
  const grab = useRef<{
    mode: "move" | "size";
    pointerX: number;
    pointerY: number;
    rect: FrameRect;
  } | null>(null);
  const done = useRef<HTMLButtonElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => done.current?.focus({ preventScroll: true }), []);
  // Framing needs the whole photo, not the cropped library poster.
  useEffect(() => {
    let cancelled = false;
    if (asset)
      void platform
        .assetUrl(asset.id)
        .then((url) => {
          if (!cancelled) setPhotoUrl(url);
        })
        .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [platform, asset]);
  if (!asset || !asset.width || !asset.height) return null;
  const quarter =
    scene.transform.rotation === 90 || scene.transform.rotation === 270;
  const photoWidth = quarter ? asset.height : asset.width;
  const photoHeight = quarter ? asset.width : asset.height;
  const target = frameDimensions(project.ratio, "720p");
  const geometry = frameGeometry(
    photoWidth,
    photoHeight,
    target.width,
    target.height,
    scene.fit,
  );
  const poses = cameraEndpoints(scene);
  const rects = { from: geometry.toRect(poses.from), to: geometry.toRect(poses.to) };
  // Fit the whole photo inside the stage with room for the toolbar.
  const room = { width: area.width - 48, height: area.height - 120 };
  const fit = Math.min(room.width / photoWidth, room.height / photoHeight);
  const photo = {
    width: photoWidth * fit,
    height: photoHeight * fit,
  };
  const commit = (which: "from" | "to", rect: FrameRect) => {
    const pose = geometry.toPose(rect);
    const other = which === "from" ? poses.to : poses.from;
    const from = which === "from" ? pose : other;
    const to = which === "from" ? other : pose;
    onChange({
      transform: {
        ...scene.transform,
        motion: "custom",
        focusX: from.focusX,
        focusY: from.focusY,
        zoom: from.zoom,
        endFocusX: to.focusX,
        endFocusY: to.focusY,
        endZoom: to.zoom,
      },
    });
  };
  const constrain = (rect: FrameRect): FrameRect => {
    const minimum = geometry.toRect({ focusX: 0.5, focusY: 0.5, zoom: ZOOM_LIMITS.max });
    const maximum = geometry.toRect({ focusX: 0.5, focusY: 0.5, zoom: ZOOM_LIMITS.min });
    const width = clamp(rect.width, minimum.width, maximum.width);
    const height = (width / maximum.width) * maximum.height;
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    const left = width < 1 ? clamp(centreX - width / 2, 0, 1 - width) : (1 - width) / 2;
    const top = height < 1 ? clamp(centreY - height / 2, 0, 1 - height) : (1 - height) / 2;
    return { left, top, width, height };
  };
  const pointerRect = (event: ReactPointerEvent): FrameRect | null => {
    const state = grab.current;
    if (!state) return null;
    const dx = (event.clientX - state.pointerX) / photo.width;
    const dy = (event.clientY - state.pointerY) / photo.height;
    if (state.mode === "move")
      return constrain({
        ...state.rect,
        left: state.rect.left + dx,
        top: state.rect.top + dy,
      });
    const grow = Math.max(dx, (dy * state.rect.width) / state.rect.height);
    return constrain({
      left: state.rect.left - grow,
      top: state.rect.top - (grow * state.rect.height) / state.rect.width,
      width: state.rect.width + grow * 2,
      height: state.rect.height + (grow * 2 * state.rect.height) / state.rect.width,
    });
  };
  const nudge = (event: ReactKeyboardEvent, which: "from" | "to") => {
    const rect = rects[which];
    const step = event.shiftKey ? NUDGE_LARGE : NUDGE;
    const moves: Record<string, Partial<FrameRect>> = {
      ArrowLeft: { left: rect.left - step },
      ArrowRight: { left: rect.left + step },
      ArrowUp: { top: rect.top - step },
      ArrowDown: { top: rect.top + step },
    };
    if (event.key in moves) {
      event.preventDefault();
      commit(which, constrain({ ...rect, ...moves[event.key] }));
    } else if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      const factor = event.key === "-" ? 1.06 : 1 / 1.06;
      const width = rect.width * factor;
      const height = rect.height * factor;
      commit(
        which,
        constrain({
          left: rect.left + (rect.width - width) / 2,
          top: rect.top + (rect.height - height) / 2,
          width,
          height,
        }),
      );
    }
  };
  const quarterStyle = quarter
    ? { width: photo.height, height: photo.width }
    : { width: photo.width, height: photo.height };
  return (
    <div className="framing-layer" role="group" aria-label={t("Framing")}>
      <div className="framing-toolbar">
        <div className="segmented" role="group" aria-label={t("Frame to edit")}>
          <button
            type="button"
            aria-pressed={end === "from"}
            onClick={() => setEnd("from")}
          >
            {t("Start")}
          </button>
          <button
            type="button"
            aria-pressed={end === "to"}
            onClick={() => setEnd("to")}
          >
            {t("End")}
          </button>
        </div>
        <button
          type="button"
          className="button stage-secondary"
          onClick={() => {
            onChange({
              transform: {
                ...scene.transform,
                motion: "custom",
                focusX: poses.to.focusX,
                focusY: poses.to.focusY,
                zoom: poses.to.zoom,
                endFocusX: poses.from.focusX,
                endFocusY: poses.from.focusY,
                endZoom: poses.from.zoom,
              },
            });
          }}
        >
          <ArrowLeftRight size={15} aria-hidden="true" />
          {t("Swap")}
        </button>
        <button
          ref={done}
          type="button"
          className="button stage-primary"
          onClick={onDone}
        >
          <Check size={15} aria-hidden="true" />
          {t("Done")}
        </button>
      </div>
      <div
        className="framing-photo"
        style={{ width: photo.width, height: photo.height }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onDone();
          }
        }}
      >
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            draggable={false}
            style={{
              ...quarterStyle,
              transform: `translate(-50%, -50%) rotate(${scene.transform.rotation}deg) scale(${scene.transform.flipX ? -1 : 1}, ${scene.transform.flipY ? -1 : 1})`,
            }}
          />
        )}
        {(end === "from"
          ? (["to", "from"] as const)
          : (["from", "to"] as const)
        ).map((which) => {
            const rect = which === end && live ? live : rects[which];
            const active = which === end;
            return (
              <div
                key={which}
                className={`frame-rect ${active ? "active" : ""} frame-${which}`}
                style={{
                  left: `${rect.left * 100}%`,
                  top: `${rect.top * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                  boxShadow: active
                    ? `0 0 0 ${Math.max(area.width, area.height) * 2}px rgb(0 0 0 / 58%)`
                    : undefined,
                }}
              >
                <button
                  type="button"
                  className="frame-body"
                  aria-label={t(
                    which === "from"
                      ? "Start frame. Drag or use arrow keys to move, plus and minus to resize."
                      : "End frame. Drag or use arrow keys to move, plus and minus to resize.",
                  )}
                  tabIndex={active ? 0 : -1}
                  onFocus={() => setEnd(which)}
                  onKeyDown={(event) => nudge(event, which)}
                  onPointerDown={(event) => {
                    setEnd(which);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    grab.current = {
                      mode: "move",
                      pointerX: event.clientX,
                      pointerY: event.clientY,
                      rect: rects[which],
                    };
                  }}
                  onPointerMove={(event) => {
                    const next = pointerRect(event);
                    if (next) setLive(next);
                  }}
                  onPointerUp={(event) => {
                    const next = pointerRect(event);
                    grab.current = null;
                    setLive(null);
                    if (next) commit(which, next);
                  }}
                >
                  <span className="frame-label">
                    {t(which === "from" ? "Start" : "End")}
                  </span>
                </button>
                {active && (
                  <span
                    className="frame-corner"
                    aria-hidden="true"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      grab.current = {
                        mode: "size",
                        pointerX: event.clientX,
                        pointerY: event.clientY,
                        rect: rects[which],
                      };
                    }}
                    onPointerMove={(event) => {
                      const next = pointerRect(event);
                      if (next) setLive(next);
                    }}
                    onPointerUp={(event) => {
                      const next = pointerRect(event);
                      grab.current = null;
                      setLive(null);
                      if (next) commit(which, next);
                    }}
                  />
                )}
              </div>
            );
          })}
      </div>
      <p className="framing-hint">
        {t(
          end === "from"
            ? "Where the camera starts. Drag the frame; drag its corner to zoom."
            : "Where the camera ends. Drag the frame; drag its corner to zoom.",
        )}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- root */

/**
 * Editing handles over the stage picture for the selected scene: text items
 * can be dragged where they are drawn, and framing mode sets the camera's
 * start and end on the whole photo. Keyboard equivalents exist for both.
 */
export function StageOverlay({
  project,
  scene,
  time,
  framing,
  platform,
  onChange,
  onFramingDone,
}: {
  project: Project;
  scene: Scene;
  time: number;
  framing: boolean;
  platform: CortoPlatform;
  onChange: (changes: Partial<Scene>) => void;
  onFramingDone: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const findCanvas = useMemo(
    () => () =>
      root.current?.parentElement?.querySelector(
        '[data-testid="preview-canvas"]',
      ) ?? null,
    [],
  );
  const frame = useRelativeBox(root, findCanvas);
  const [area, setArea] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () =>
      setArea({
        left: 0,
        top: 0,
        width: element.clientWidth,
        height: element.clientHeight,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const entry = buildTimeline(project.scenes).find(
    (candidate) => candidate.scene.id === scene.id,
  );
  const localTime = entry ? time - entry.start : -1;
  const asset = scene.assetId ? project.assets[scene.assetId] : null;
  const showFraming = framing && asset?.kind === "image" && area;
  return (
    <div
      ref={root}
      className={`stage-overlay ${showFraming ? "framing" : ""}`}
    >
      {showFraming ? (
        <FramingLayer
          project={project}
          scene={scene}
          platform={platform}
          area={area}
          onChange={onChange}
          onDone={onFramingDone}
        />
      ) : (
        frame &&
        localTime >= 0 &&
        localTime < scene.duration &&
        scene.textItems.length > 0 && (
          <WordsLayer
            project={project}
            scene={scene}
            localTime={localTime}
            frame={frame}
            onChange={onChange}
          />
        )
      )}
    </div>
  );
}
