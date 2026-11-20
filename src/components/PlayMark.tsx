/** Paths from the supplied Corto mark (brand/corto-brand-assets), unmodified. */
const PILLAR = "M58 29A29 29 0 0 0 0 29L0 351A29 29 0 0 0 58 351L58 29Z";
const PLAY =
  "M71 42.567L71 109.335L201.79 183.919A7 7 0 0 1 201.79 196.081L71 270.665L71 337.433L230.522 246.464A65 65 0 0 0 230.522 133.536L71 42.567Z";
/** The second pillar that turns the mark into pause; same width and caps as the first. */
const SECOND_PILLAR = "M208 29A29 29 0 0 0 150 29L150 351A29 29 0 0 0 208 351Z";

/** Corto's mark as an inline shape that follows the current text colour. */
export function CortoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`corto-mark ${className}`}
      viewBox="0 0 264 380"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PILLAR} />
      <path d={PLAY} />
    </svg>
  );
}

/**
 * The play button is the mark. Playing slides the triangle behind the pillar
 * while a second pillar rises beside it: pause. Pure CSS transitions, so
 * reduced motion simply shows the end state.
 */
export function PlayMark({ playing }: { playing: boolean }) {
  return (
    <svg
      className={`play-mark ${playing ? "is-playing" : ""}`}
      viewBox="0 0 264 380"
      aria-hidden="true"
      focusable="false"
    >
      <g className="play-mark-group">
        <path className="play-mark-triangle" d={PLAY} />
        <path className="play-mark-bar" d={SECOND_PILLAR} />
        <path d={PILLAR} />
      </g>
    </svg>
  );
}
