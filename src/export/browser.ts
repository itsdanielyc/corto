import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
} from "../../contracts/platform";
import {
  EXPORT_FPS,
  FADE_SECONDS,
  parseProject,
} from "../../contracts/project";
import { fadeOpacity, filmDuration, frameDimensions } from "../domain/timeline";
import { disposeMedia, waitForMedia } from "../media/import";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { loadCaptionFonts } from "../preview/captions";
import { MediaPool } from "../preview/media-pool";
import { renderFrame } from "../preview/render-frame";
import { seekVideo } from "../preview/seek";
import { browserRecordingFormat } from "./format";
import { finalizeWebm } from "./finalize-webm";

const AUDIO_SAMPLE_RATE = 48000;
const AUDIO_BITRATE = 192000;
const VIDEO_BITRATES = { "720p": 4_000_000, "1080p": 8_000_000 } as const;

function nextFrame(signal: AbortSignal): Promise<number> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancelled = () => {
      cancelAnimationFrame(frame);
      reject(signal.reason);
    };
    const frame = requestAnimationFrame((time) => {
      signal.removeEventListener("abort", cancelled);
      resolve(time);
    });
    signal.addEventListener("abort", cancelled, { once: true });
  });
}

// Time O(output frames × pixels), space O(one decoded scene + recorded output chunks).
/** Record the real canvas and mixed source audio locally; no network encoder or media upload exists. */
export async function renderBrowserMovie(
  request: MovieRequest,
  assetUrl: (id: string) => Promise<string>,
  progress: (value: ExportProgress) => void,
  signal: AbortSignal,
): Promise<MovieResult> {
  const project = parseProject(request.project);
  const format = browserRecordingFormat();
  if (!format)
    throw new Error(
      "This browser cannot record movies. Use a current desktop browser or the Corto desktop app.",
    );
  if (!project.scenes.length)
    throw new Error("Add at least one scene before exporting");
  const visibility = new AbortController();
  const activeSignal = AbortSignal.any([signal, visibility.signal]);
  const hidden = () => {
    if (document.hidden)
      visibility.abort(
        new Error("The tab was hidden. Keep Corto visible and export again."),
      );
  };
  document.addEventListener("visibilitychange", hidden);
  const canvas = document.createElement("canvas");
  const dimensions = frameDimensions(project.ratio, request.resolution);
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const drawing = canvas.getContext("2d", { alpha: false });
  if (!drawing) throw new Error("A drawing surface could not be created");
  const pool = new MediaPool();
  const audio = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
  const destination = audio.createMediaStreamDestination();
  const clipGain = audio.createGain();
  const musicGain = audio.createGain();
  clipGain.connect(destination);
  musicGain.connect(destination);
  const silence = audio.createConstantSource();
  silence.offset.value = 0;
  silence.connect(destination);
  silence.start();
  const stream = new MediaStream([
    ...canvas.captureStream(EXPORT_FPS).getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mime,
    videoBitsPerSecond: VIDEO_BITRATES[request.resolution],
    audioBitsPerSecond: AUDIO_BITRATE,
  });
  const chunks: Blob[] = [];
  let soundtrack: HTMLAudioElement | null = null;
  let musicSource: MediaElementAudioSourceNode | null = null;
  const sources = new WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>();
  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: format.mime }));
    recorder.onerror = () =>
      reject(
        new Error(
          "The browser stopped recording. Close other demanding tabs and try again, or use the desktop app.",
        ),
      );
  });
  void recorded.catch(() => undefined);
  try {
    activeSignal.throwIfAborted();
    await audio.resume();
    await loadCaptionFonts();
    if (project.music) {
      soundtrack = new Audio(await assetUrl(project.music.assetId));
      soundtrack.loop = project.music.loop;
      soundtrack.preload = "auto";
      await waitForMedia(soundtrack);
      musicSource = audio.createMediaElementSource(soundtrack);
      musicSource.connect(musicGain);
    }
    const total = filmDuration(project.scenes);
    let completed = 0;
    for (let index = 0; index < project.scenes.length; index++) {
      activeSignal.throwIfAborted();
      const scene = project.scenes[index];
      const asset = scene.assetId ? project.assets[scene.assetId] : null;
      const media = asset
        ? await pool.get(asset, await assetUrl(asset.id))
        : null;
      let source: MediaElementAudioSourceNode | null = null;
      if (media instanceof HTMLVideoElement) {
        await seekVideo(media, scene.start, activeSignal);
        source = sources.get(media) ?? audio.createMediaElementSource(media);
        sources.set(media, source);
        source.connect(clipGain);
        media.volume = 1;
      }
      renderFrame(drawing, scene, media, 0);
      if (recorder.state === "inactive") recorder.start(250);
      else recorder.resume();
      if (media instanceof HTMLVideoElement) await media.play();
      if (
        soundtrack &&
        project.music &&
        (project.music.loop || completed < soundtrack.duration)
      ) {
        soundtrack.currentTime = project.music.loop
          ? completed % soundtrack.duration
          : completed;
        await soundtrack.play();
      }
      const started = performance.now();
      let elapsed = 0;
      let paintedFrame = -1;
      let notifiedAt = -Infinity;
      while (elapsed < scene.duration) {
        activeSignal.throwIfAborted();
        const globalTime = completed + elapsed;
        const frame = Math.floor(elapsed * EXPORT_FPS);
        if (frame !== paintedFrame) {
          musicGain.gain.value =
            (project.music?.volume ?? 0) *
            Math.max(
              0,
              Math.min(
                1,
                globalTime / FADE_SECONDS,
                (total - globalTime) / FADE_SECONDS,
              ),
            );
          clipGain.gain.value = scene.volume * fadeOpacity(scene, elapsed);
          renderFrame(drawing, scene, media, elapsed);
          paintedFrame = frame;
        }
        if (elapsed - notifiedAt >= 0.1) {
          progress({
            fraction: Math.min(0.99, globalTime / total),
            message: `Recording scene ${index + 1} of ${project.scenes.length}`,
          });
          notifiedAt = elapsed;
        }
        elapsed = ((await nextFrame(activeSignal)) - started) / 1000;
      }
      recorder.pause();
      if (media instanceof HTMLVideoElement) media.pause();
      soundtrack?.pause();
      source?.disconnect();
      completed += scene.duration;
      pool.retain(new Set());
    }
    recorder.stop();
    let movie = await recorded;
    activeSignal.throwIfAborted();
    if (format.extension === "webm") {
      progress({ fraction: 0.995, message: "Finishing your movie" });
      movie = await finalizeWebm(movie, activeSignal);
    }
    if (!movie.size)
      throw new Error(
        "The browser produced an empty movie. Try the desktop app.",
      );
    const fileName = `${projectFileName(project.name)}.${format.extension}`;
    downloadBlob(movie, fileName);
    progress({ fraction: 1, message: "Your movie is ready" });
    return { fileName, format: format.label, location: "download" };
  } finally {
    if (recorder.state !== "inactive") {
      recorder.stop();
      await recorded.catch(() => undefined);
    }
    if (soundtrack) disposeMedia(soundtrack);
    musicSource?.disconnect();
    silence.stop();
    stream.getTracks().forEach((track) => track.stop());
    pool.dispose();
    await audio.close();
    document.removeEventListener("visibilitychange", hidden);
  }
}
