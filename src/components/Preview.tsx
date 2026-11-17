import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Maximize2 } from "lucide-react";
import type { Project } from "../../contracts/project";
import { filmDuration, frameDimensions } from "../domain/timeline";
import type { MediaResources } from "../hooks/use-resources";
import { AudioTimelinePlayer } from "../preview/audio-timeline";
import type { CortoPlatform } from "../platform/types";
import { loadCaptionFonts } from "../preview/captions";
import { CompositionPlayer } from "../preview/composition-player";
import { renderProjectFrame } from "../preview/composite";
import { IconButton } from "./primitives";

interface PreviewProperties {
  project: Project;
  platform: CortoPlatform;
  resources: MediaResources;
  time: number;
  playing: boolean;
  onTime: (time: number) => void;
  onPlaying: (playing: boolean) => void;
  report: (error: unknown) => void;
}

/** A single composition surface serves still preview, playback and browser/native export assets. */
export function Preview({
  project,
  platform,
  time,
  playing,
  onTime,
  onPlaying,
  report,
}: PreviewProperties) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const clock = useRef(time);
  const [status, setStatus] = useState("Ready");
  const player = useMemo(
    () =>
      new CompositionPlayer(
        project,
        (id) => platform.assetUrl(id),
        undefined,
        true,
      ),
    [project, platform],
  );
  const sound = useMemo(
    () =>
      new AudioTimelinePlayer(project, (id) => platform.assetUrl(id), report),
    [project, platform, report],
  );
  const dimensions = frameDimensions(project.ratio, "720p");
  const total = filmDuration(project.scenes);
  useEffect(() => () => player.dispose(), [player]);
  useEffect(() => {
    void sound.prepare().catch(report);
    return () => sound.dispose();
  }, [sound, report]);
  useEffect(() => {
    if (!playing) clock.current = time;
  }, [time, playing]);

  useEffect(() => {
    const controller = new AbortController();
    let animation = 0;
    let previous = performance.now();
    let notified = previous;
    const paint = async () => {
      const media = await player.prepare(
        playing ? clock.current : time,
        controller.signal,
      );
      controller.signal.throwIfAborted();
      if (playing) await player.play(media, clock.current);
      const context = canvas.current?.getContext("2d");
      if (context)
        renderProjectFrame(
          context,
          project,
          playing ? clock.current : time,
          media,
          playing || time > 0,
        );
      setStatus("Ready");
      if (!playing) return;
      sound.sync(clock.current, true);
      const now = performance.now();
      clock.current = Math.min(
        total,
        clock.current + Math.min(0.1, (now - previous) / 1000),
      );
      previous = now;
      if (now - notified >= 100) {
        onTime(clock.current);
        notified = now;
      }
      if (clock.current >= total) {
        onTime(total);
        onPlaying(false);
        return;
      }
      animation = requestAnimationFrame(() => {
        void paint().catch(failed);
      });
    };
    const failed = (error: unknown) => {
      if (!controller.signal.aborted) {
        setStatus("Media missing");
        report(error);
        onPlaying(false);
      }
    };
    const hidden = () => {
      if (document.hidden && playing) {
        onTime(clock.current);
        onPlaying(false);
      }
    };
    if (!playing) {
      player.pause();
      sound.pause();
    }
    if (project.scenes.length)
      void loadCaptionFonts().then(paint).catch(failed);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      controller.abort();
      cancelAnimationFrame(animation);
      player.pause();
      sound.pause();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [
    playing,
    playing ? null : time,
    project,
    player,
    sound,
    total,
    onTime,
    onPlaying,
    report,
  ]);

  return (
    <div
      className={`preview-stage ${project.scenes.length ? "has-film" : ""}`}
      ref={stage}
      data-geo="preview"
    >
      {project.scenes.length ? (
        <>
          <canvas
            ref={canvas}
            width={dimensions.width}
            height={dimensions.height}
            data-ratio={project.ratio}
            data-testid="preview-canvas"
            aria-label="Film preview"
          />
          <IconButton
            icon={Maximize2}
            label="Full screen preview"
            className="fullscreen-button"
            onClick={() => {
              void stage.current?.requestFullscreen().catch(report);
            }}
          />
        </>
      ) : (
        <div className="empty-preview">
          <img
            src={`${import.meta.env.BASE_URL}brand/corto-mark-white.svg`}
            alt=""
          />
          <p>
            A little life.
            <br />
            <em>A little film.</em>
          </p>
          <span>Your photos, clips and stories go here.</span>
          <Film size={18} aria-hidden="true" />
        </div>
      )}
      <span className="sr-only" data-testid="preview-status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
