import { useT } from "../i18n/locale";
import type { Project } from "../../contracts/project";
import { filmDuration, formatTime } from "../domain/timeline";
import { outputFrameRate } from "../domain/render-plan";
const STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
export function TimelineRuler({
  project,
  zoom,
  time,
  onSeek,
}: {
  project: Project;
  zoom: number;
  time: number;
  onSeek: (time: number) => void;
}) {
  const t = useT();
  const total = filmDuration(project.scenes);
  const desired = Math.max(80 / zoom, total / 300);
  const step = STEPS.find((value) => value >= desired) ?? 300;
  const ticks = Array.from(
    { length: Math.floor(total / step) + 1 },
    (_, index) => index * step,
  );
  const width = total * zoom + 4;
  const markers = project.markers.filter((marker) => marker.time <= total);
  return (
    <div style={{ width }}>
      <div
        className="timeline-ruler"
        role="slider"
        tabIndex={0}
        aria-label={t("Timeline ruler")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={time}
        aria-valuetext={`${time.toFixed(2)} s`}
        onPointerDown={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          onSeek(
            Math.max(
              0,
              Math.min(total, (event.clientX - bounds.left - 2) / zoom),
            ),
          );
        }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          event.stopPropagation();
          onSeek(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? total
                : Math.max(
                    0,
                    Math.min(
                      total,
                      time +
                        (event.key === "ArrowRight" ? 1 : -1) /
                          outputFrameRate(project),
                    ),
                  ),
          );
        }}
      >
        {ticks.map((value) => (
          <span key={value} style={{ left: 2 + value * zoom }}>
            {step < 1 ? `${value.toFixed(2)}s` : formatTime(value)}
          </span>
        ))}
        <i className="timeline-playhead" style={{ left: 2 + time * zoom }} />
      </div>
      {markers.length > 0 && (
        <div className="timeline-markers">
          {markers.map((marker) => (
            <button
              key={marker.id}
              style={{ left: 2 + marker.time * zoom }}
              title={marker.name}
              aria-label={`${t("Marker")}: ${marker.name}`}
              onClick={() => onSeek(marker.time)}
            >
              ◆<span>{marker.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
