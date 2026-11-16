import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Maximize2 } from "lucide-react";
import { FADE_SECONDS, type Project } from "../../contracts/project";
import {
  buildTimeline,
  fadeOpacity,
  frameDimensions,
  locateScene,
} from "../domain/timeline";
import type { MediaResources } from "../hooks/use-resources";
import { disposeMedia } from "../media/import";
import { loadCaptionFonts } from "../preview/captions";
import { MediaPool } from "../preview/media-pool";
import { renderFrame } from "../preview/render-frame";
import { seekVideo } from "../preview/seek";
import { IconButton } from "./primitives";

interface PreviewProperties {
  project: Project;
  resources: MediaResources;
  time: number;
  playing: boolean;
  onTime: (time: number) => void;
  onPlaying: (playing: boolean) => void;
  report: (error: unknown) => void;
}

const UI_UPDATE_INTERVAL_MS = 100;
const VIDEO_DRIFT_SECONDS = 0.25;

/** A bounded decoder pool paints one composition; UI time updates are throttled independently. */
export function Preview({
  project,
  resources,
  time,
  playing,
  onTime,
  onPlaying,
  report,
}: PreviewProperties) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pool = useRef(new MediaPool());
  const clock = useRef(time);
  const music = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState("Ready");
  const timeline = useMemo(
    () => buildTimeline(project.scenes),
    [project.scenes],
  );
  const dimensions = frameDimensions(project.ratio, "720p");
  const total = timeline.at(-1)?.end ?? 0;

  useEffect(() => () => pool.current.dispose(), []);
  useEffect(() => {
    if (!playing) clock.current = time;
  }, [time, playing]);

  useEffect(() => {
    if (!project.music) return;
    const resource = resources[project.music.assetId];
    if (!resource?.url) return;
    const audio = new Audio(resource.url);
    audio.preload = "auto";
    audio.loop = project.music.loop;
    music.current = audio;
    return () => {
      if (music.current === audio) music.current = null;
      disposeMedia(audio);
    };
  }, [project.music?.assetId, project.music?.loop, resources]);

  useEffect(() => {
    if (playing) return;
    pool.current.pauseExcept(null);
    music.current?.pause();
    const located = locateScene(timeline, time);
    if (!located) return;
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      await loadCaptionFonts();
      const asset = located.scene.assetId
        ? project.assets[located.scene.assetId]
        : null;
      const resource = asset ? resources[asset.id] : null;
      if (asset && !resource) {
        setStatus("Loading preview");
        return;
      }
      if (resource?.error) throw new Error(resource.error);
      const media =
        asset && resource ? await pool.current.get(asset, resource.url) : null;
      if (media instanceof HTMLVideoElement)
        await seekVideo(
          media,
          located.scene.start + located.localTime,
          controller.signal,
        );
      if (cancelled) return;
      const context = canvas.current?.getContext("2d");
      if (context)
        renderFrame(context, located.scene, media, located.localTime, time > 0);
      setStatus("Ready");
      const next = timeline[located.index + 1]?.scene.assetId;
      const kept = new Set(
        [located.scene.assetId, next].filter((id): id is string => !!id),
      );
      pool.current.retain(kept);
      if (next && resources[next]?.url)
        void pool.current
          .get(project.assets[next], resources[next].url)
          .catch(() => undefined);
    })().catch((error) => {
      if (!cancelled) {
        setStatus("Media missing");
        report(error);
      }
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    playing,
    timeline,
    time,
    resources,
    project.assets,
    dimensions.width,
    dimensions.height,
    report,
  ]);

  useEffect(() => {
    if (!playing || !total) return;
    let cancelled = false;
    let animation = 0;
    let last = performance.now();
    let notified = last;
    let preparedScene: string | null = null;
    let preparingScene: string | null = null;
    let startingMusic = false;
    const controller = new AbortController();
    const stopWithError = (error: unknown) => {
      if (!cancelled) {
        report(error);
        onPlaying(false);
      }
    };
    const tick = (now: number) => {
      if (cancelled) return;
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      const located = locateScene(timeline, clock.current);
      if (!located) {
        onPlaying(false);
        return;
      }
      const { scene, localTime } = located;
      const asset = scene.assetId ? project.assets[scene.assetId] : null;
      const resource = asset ? resources[asset.id] : null;
      const media = asset ? pool.current.ready(asset.id) : null;
      let ready = !asset || !!media;
      pool.current.pauseExcept(scene.assetId);
      if (asset && !media && resource?.url)
        void pool.current.get(asset, resource.url).catch(stopWithError);
      if (resource?.error) {
        stopWithError(new Error(resource.error));
        return;
      }
      if (media instanceof HTMLVideoElement) {
        media.volume = scene.volume * fadeOpacity(scene, localTime);
        if (preparedScene !== scene.id) {
          ready = false;
          if (preparingScene !== scene.id) {
            preparingScene = scene.id;
            media.pause();
            void seekVideo(media, scene.start + localTime, controller.signal)
              .then(() => media.play())
              .then(() => {
                if (!cancelled) preparedScene = scene.id;
                else media.pause();
              })
              .catch(stopWithError);
          }
        } else if (
          Math.abs(media.currentTime - (scene.start + localTime)) >
          VIDEO_DRIFT_SECONDS
        )
          media.currentTime = scene.start + localTime;
      }
      const soundtrack = music.current;
      if (soundtrack && project.music) {
        const withinMusic =
          project.music.loop ||
          clock.current < (soundtrack.duration || Infinity);
        soundtrack.volume =
          project.music.volume *
          Math.max(
            0,
            Math.min(
              1,
              clock.current / FADE_SECONDS,
              (total - clock.current) / FADE_SECONDS,
            ),
          );
        if (!ready || !withinMusic) soundtrack.pause();
        else if (
          soundtrack.paused &&
          !startingMusic &&
          soundtrack.readyState >= 1
        ) {
          startingMusic = true;
          soundtrack.currentTime = project.music.loop
            ? clock.current % soundtrack.duration
            : clock.current;
          void soundtrack
            .play()
            .catch(stopWithError)
            .finally(() => {
              startingMusic = false;
            });
        } else if (
          withinMusic &&
          soundtrack.duration &&
          Math.abs(
            soundtrack.currentTime - (clock.current % soundtrack.duration),
          ) > VIDEO_DRIFT_SECONDS
        )
          soundtrack.currentTime = clock.current % soundtrack.duration;
      }
      if (ready) {
        const context = canvas.current?.getContext("2d");
        if (context) renderFrame(context, scene, media, localTime);
        clock.current = Math.min(total, clock.current + delta);
        setStatus((previous) => (previous === "Ready" ? previous : "Ready"));
        if (now - notified >= UI_UPDATE_INTERVAL_MS) {
          onTime(clock.current);
          notified = now;
        }
        const next = timeline[located.index + 1]?.scene.assetId;
        pool.current.retain(
          new Set([scene.assetId, next].filter((id): id is string => !!id)),
        );
        if (next && resources[next]?.url)
          void pool.current
            .get(project.assets[next], resources[next].url)
            .catch(() => undefined);
      }
      if (clock.current >= total) {
        onTime(total);
        onPlaying(false);
        return;
      }
      animation = requestAnimationFrame(tick);
    };
    void loadCaptionFonts()
      .then(() => {
        if (!cancelled) animation = requestAnimationFrame(tick);
      })
      .catch(stopWithError);
    const hidden = () => {
      if (document.hidden) {
        onTime(clock.current);
        onPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animation);
      controller.abort();
      pool.current.pauseExcept(null);
      music.current?.pause();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [
    playing,
    timeline,
    project.assets,
    project.music,
    resources,
    total,
    onPlaying,
    onTime,
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
