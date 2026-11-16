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
import {
  buildTimeline,
  locateScene,
  fadeOpacity,
  filmDuration,
  frameDimensions,
} from "../domain/timeline";
import { disposeMedia, waitForMedia, type VisualMedia } from "../media/import";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { loadCaptionFonts } from "../preview/captions";
import { MediaPool } from "../preview/media-pool";
import { renderFrame } from "../preview/render-frame";
import { seekVideo } from "../preview/seek";
import { browserRecordingFormat } from "./format";
import { finalizeWebm } from "./finalize-webm";
import { withCancellation } from "./cancellation";

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

// Time O(output frames × pixels), space O(current/next decoded scenes + recorded output chunks).
/** Record the real canvas and mixed source audio locally; no network encoder or media upload exists. */
export async function renderBrowserMovie(
  request: MovieRequest,
  assetUrl: (id: string) => Promise<string>,
  progress: (value: ExportProgress) => void,
  signal: AbortSignal,
  surface?: HTMLCanvasElement,
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
  const canvas = surface ?? document.createElement("canvas");
  const dimensions = frameDimensions(project.ratio, request.resolution);
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const drawing = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });
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
  const videoStream = canvas.captureStream(0);
  const videoTrack =
    videoStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  if (typeof videoTrack.requestFrame !== "function")
    throw new Error(
      "This browser cannot capture individual movie frames. Try the desktop app.",
    );
  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
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
      const preparedMusic = soundtrack;
      await withCancellation(() => preparedMusic.play(), activeSignal);
      preparedMusic.pause();
      preparedMusic.currentTime = 0;
    }
    const timeline = buildTimeline(project.scenes);
    const total = filmDuration(project.scenes);
    interface PreparedScene {
      media: VisualMedia | null;
      source: MediaElementAudioSourceNode | null;
    }
    const prepared = new Map<number, PreparedScene>();
    const preparing = new Map<number, Promise<void>>();
    let playbackError: unknown = null;
    const prepareScene = (index: number): Promise<void> => {
      if (index >= project.scenes.length) return Promise.resolve();
      const existing = preparing.get(index);
      if (existing) return existing;
      const operation = (async () => {
        const scene = project.scenes[index];
        const asset = scene.assetId ? project.assets[scene.assetId] : null;
        const media = asset
          ? await withCancellation(
              async () => pool.get(asset, await assetUrl(asset.id), scene.id),
              activeSignal,
            )
          : null;
        let source: MediaElementAudioSourceNode | null = null;
        if (media instanceof HTMLVideoElement) {
          source = audio.createMediaElementSource(media);
          await seekVideo(media, scene.start, activeSignal);
          await withCancellation(() => media.play(), activeSignal);
          media.pause();
          await seekVideo(media, scene.start, activeSignal);
        }
        prepared.set(index, { media, source });
      })();
      preparing.set(index, operation);
      return operation;
    };
    await Promise.all([prepareScene(0), prepareScene(1)]);
    activeSignal.throwIfAborted();
    const initial = prepared.get(0)!;
    renderFrame(drawing, project.scenes[0], initial.media, 0);
    if (soundtrack)
      void soundtrack.play().catch((error) => {
        playbackError = error;
      });
    recorder.start(250);
    videoTrack.requestFrame();
    const started = performance.now();
    let elapsed = 0;
    let activeIndex = -1;
    let activeMedia: PreparedScene | null = null;
    let paintedFrame = -1;
    let notifiedAt = -Infinity;
    while (elapsed < total) {
      activeSignal.throwIfAborted();
      if (playbackError) throw playbackError;
      const location = locateScene(timeline, elapsed)!;
      if (activeIndex !== location.index) {
        if (activeMedia?.media instanceof HTMLVideoElement)
          activeMedia.media.pause();
        activeMedia?.source?.disconnect();
        const next = prepared.get(location.index);
        if (!next)
          throw new Error(
            "This device could not prepare the next scene in real time. Try the desktop app for this film.",
          );
        activeMedia = next;
        activeIndex = location.index;
        if (next.media instanceof HTMLVideoElement)
          void next.media.play().catch((error) => {
            playbackError = error;
          });
        next.source?.connect(clipGain);
        for (const index of prepared.keys())
          if (index < activeIndex) {
            prepared.delete(index);
            preparing.delete(index);
          }
        pool.retain(
          new Set(
            [
              project.scenes[activeIndex].id,
              project.scenes[activeIndex + 1]?.id,
            ].filter((id): id is string => !!id),
          ),
        );
        void prepareScene(activeIndex + 1).catch((error) => {
          if (!activeSignal.aborted) playbackError = error;
        });
      }
      const frame = Math.floor(elapsed * EXPORT_FPS);
      if (frame !== paintedFrame) {
        musicGain.gain.value =
          (project.music?.volume ?? 0) *
          Math.max(
            0,
            Math.min(
              1,
              elapsed / FADE_SECONDS,
              (total - elapsed) / FADE_SECONDS,
            ),
          );
        clipGain.gain.value =
          location.scene.volume *
          fadeOpacity(location.scene, location.localTime);
        renderFrame(
          drawing,
          location.scene,
          activeMedia!.media,
          location.localTime,
        );
        videoTrack.requestFrame();
        paintedFrame = frame;
      }
      if (elapsed - notifiedAt >= 0.1) {
        progress({
          fraction: Math.min(0.99, elapsed / total),
          message: `Recording scene ${activeIndex + 1} of ${project.scenes.length}`,
        });
        notifiedAt = elapsed;
      }
      elapsed = ((await nextFrame(activeSignal)) - started) / 1000;
    }
    if (activeMedia?.media instanceof HTMLVideoElement)
      activeMedia.media.pause();
    soundtrack?.pause();
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
