import { useT } from "../../i18n/locale";
import type { KeyboardEvent, ReactNode } from "react";
import type { Scene } from "../../../contracts/project";
import { MOTION_CHOICES, TRANSITION_CHOICES } from "./choice-lists";

/** Arrow keys move the selection through a radio group, as native radios do. */
function roveRadio<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  values: readonly T[],
  value: T,
  onChange: (value: T) => void,
  columns: number,
) {
  const step: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: columns,
    ArrowUp: -columns,
  };
  if (!(event.key in step)) return;
  event.preventDefault();
  const index = values.indexOf(value);
  const next =
    values[(index + step[event.key] + values.length) % values.length];
  onChange(next);
  event.currentTarget
    .querySelector<HTMLElement>(`[data-value="${next}"]`)
    ?.focus();
}

/** A labelled radio group drawn as picture tiles. */
export function TileChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  art,
  columns = 3,
  className = "",
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  art: (value: T) => ReactNode;
  columns?: number;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      className={`tile-grid ${className}`}
      role="radiogroup"
      aria-label={t(label)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      onKeyDown={(event) =>
        roveRadio(
          event,
          options.map(([id]) => id),
          value,
          onChange,
          columns,
        )
      }
    >
      {options.map(([id, name]) => (
        <button
          key={id}
          type="button"
          role="radio"
          className={`tile tile-${id}`}
          data-value={id}
          aria-checked={value === id}
          tabIndex={value === id ? 0 : -1}
          onClick={() => onChange(id)}
        >
          <span className="tile-art">{art(id)}</span>
          {t(name)}
        </button>
      ))}
    </div>
  );
}

/** Small drawings of each transition, used on tiles and at the seams. */
export function TransitionGlyph({
  transition,
  size = 16,
}: {
  transition: Scene["transition"];
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (transition) {
    case "cut":
      return (
        <svg {...common}>
          <path d="M8 2.5v11" />
        </svg>
      );
    case "fade":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.5" fill="currentColor" />
        </svg>
      );
    case "fade-white":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.5" />
        </svg>
      );
    case "dissolve":
      return (
        <svg {...common}>
          <path d="M3 3.5 8 8l-5 4.5zM13 3.5 8 8l5 4.5z" />
        </svg>
      );
    case "wipe-left":
    case "wipe-right":
      return (
        <svg
          {...common}
          style={
            transition === "wipe-right"
              ? { transform: "scaleX(-1)" }
              : undefined
          }
        >
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
          <path d="M9 3.5v9" />
          <path d="M6.5 6.5 5 8l1.5 1.5" />
        </svg>
      );
    case "slide-left":
    case "slide-right":
      return (
        <svg
          {...common}
          style={
            transition === "slide-right"
              ? { transform: "scaleX(-1)" }
              : undefined
          }
        >
          <rect x="1.5" y="4.5" width="6" height="7" rx="1" />
          <rect x="8.5" y="4.5" width="6" height="7" rx="1" />
          <path d="M5 2.5h6" />
          <path d="m6.5 1 -1.5 1.5L6.5 4" />
        </svg>
      );
    case "push-up":
      return (
        <svg {...common}>
          <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
          <path d="M3.5 8h9" />
          <path d="m6.5 5.5 1.5-1.5 1.5 1.5" />
        </svg>
      );
    case "zoom":
      return (
        <svg {...common}>
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <rect x="5.5" y="6" width="5" height="4" rx="1" />
        </svg>
      );
    case "blur":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="8" r="5" strokeDasharray="1.6 2.2" />
        </svg>
      );
  }
}

/** Moving previews of each camera move, drawn from the scene's own poster. */
export function MotionTiles({
  value,
  poster,
  onChange,
}: {
  value: Scene["transform"]["motion"];
  poster?: string;
  onChange: (value: Scene["transform"]["motion"]) => void;
}) {
  return (
    <TileChoice
      label="Motion"
      value={value}
      options={MOTION_CHOICES}
      onChange={onChange}
      columns={4}
      className="motion-tiles"
      art={(motion) => (
        <span className={`motion-art motion-${motion}`}>
          {poster ? <img src={poster} alt="" draggable={false} /> : null}
        </span>
      )}
    />
  );
}

export const LOOK_CHOICES = [
  ["none", "Original"],
  ["mono", "Black & white"],
  ["sepia", "Sepia"],
  ["warm", "Warm"],
  ["cool", "Cool"],
  ["vivid", "Vivid"],
  ["faded", "Faded film"],
] as const;

/** Look tiles show the scene's poster through an approximate CSS filter; the stage shows the exact result. */
export function LookTiles({
  value,
  poster,
  onChange,
}: {
  value: Scene["adjustments"]["look"];
  poster?: string;
  onChange: (value: Scene["adjustments"]["look"]) => void;
}) {
  return (
    <TileChoice
      label="Look"
      value={value}
      options={LOOK_CHOICES}
      onChange={onChange}
      className="look-tiles"
      art={(look) =>
        poster ? (
          <img
            src={poster}
            alt=""
            draggable={false}
            className={`look-art look-${look}`}
          />
        ) : (
          <span className={`look-art look-${look} look-swatch`} />
        )
      }
    />
  );
}

export function TransitionTiles({
  value,
  onChange,
}: {
  value: Scene["transition"];
  onChange: (value: Scene["transition"]) => void;
}) {
  return (
    <TileChoice
      label="Transition to next scene"
      value={value}
      options={TRANSITION_CHOICES}
      onChange={onChange}
      className="transition-tiles"
      columns={4}
      art={(transition) => (
        <TransitionGlyph transition={transition} size={20} />
      )}
    />
  );
}
