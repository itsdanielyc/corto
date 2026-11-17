import type {
  ExportProgress,
  MovieRequest,
  MovieResult,
} from "../../contracts/platform";
import { parseProject } from "../../contracts/project";
import { frameDimensions } from "../domain/timeline";
import { downloadBlob, projectFileName } from "../platform/browser-repository";
import { loadCaptionFonts } from "../preview/captions";
import { CompositionPlayer } from "../preview/composition-player";
import { renderProjectFrame } from "../preview/composite";
import { outputFrameRate, resolveRenderRange } from "../domain/render-plan";
import { waitForAudioClock } from "./audio-clock";
import { browserRecordingFormat } from "./format";
import { finalizeWebm } from "./finalize-webm";
import { withCancellation } from "./cancellation";
import { AudioTimelinePlayer } from "../preview/audio-timeline";
import { exportBitrate } from "./presets";

const AUDIO_SAMPLE_RATE = 48000;
const AUDIO_BITRATE = 192000;

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
async function renderRecorderMovie(
  request: MovieRequest,
  assetUrl: (id: string) => Promise<string>,
  progress: (value: ExportProgress) => void,
  signal: AbortSignal,
  surface?: HTMLCanvasElement,
): Promise<MovieResult> {
  const project = parseProject(request.project);
  const range = resolveRenderRange(project, request.range, request.sample);
  const fps = outputFrameRate(project);
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
  const audio = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
  const destination = audio.createMediaStreamDestination();
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.connect(destination);
  const player = new CompositionPlayer(project, assetUrl, limiter);
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
    videoBitsPerSecond: exportBitrate(request),
    audioBitsPerSecond: AUDIO_BITRATE,
  });
  const chunks: Blob[] = [];
  let playbackError: unknown = null;
  const soundtrack = new AudioTimelinePlayer(
    project,
    assetUrl,
    (error) => {
      playbackError = error;
    },
    limiter,
  );

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
    await withCancellation(() => soundtrack.prepare(), activeSignal);
    const total = range.end - range.start;
    let media = await player.prepare(range.start, activeSignal);
    renderProjectFrame(drawing, project, range.start, media);
    await waitForAudioClock(audio, activeSignal);
    activeSignal.throwIfAborted();
    recorder.start(250);
    const started = audio.currentTime;
    let elapsed = 0;
    let paintedFrame = -1;
    let notifiedAt = -Infinity;
    while (elapsed < total) {
      activeSignal.throwIfAborted();
      if (playbackError) throw playbackError;
      const time = range.start + elapsed;
      media = await player.prepare(time, activeSignal);
      await player.play(media, time);
      const frame = Math.floor(elapsed * fps);
      if (frame !== paintedFrame) {
        soundtrack.sync(time, true);
        renderProjectFrame(drawing, project, time, media);
        videoTrack.requestFrame();
        paintedFrame = frame;
      }
      if (elapsed - notifiedAt >= 0.1) {
        progress({
          fraction: Math.min(0.99, elapsed / total),
          message: "Recording your film",
        });
        notifiedAt = elapsed;
      }
      await nextFrame(activeSignal);
      elapsed = audio.currentTime - started;
    }
    player.pause();
    soundtrack.pause();
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
    const fileName = `${projectFileName(project.name)}${request.sample ? "-sample" : ""}.${format.extension}`;
    downloadBlob(movie, fileName);
    progress({ fraction: 1, message: "Your movie is ready" });
    return { fileName, format: format.label, location: "download" };
  } finally {
    if (recorder.state !== "inactive") {
      recorder.stop();
      await recorded.catch(() => undefined);
    }
    soundtrack.dispose();
    silence.stop();
    stream.getTracks().forEach((track) => track.stop());
    player.dispose();
    await audio.close();
    document.removeEventListener("visibilitychange", hidden);
  }
}

/** Normal exports use frame budgets, so OS media clocks cannot truncate or stretch the encoded movie. */
export async function renderBrowserMovie(
  request: MovieRequest,
  assetUrl: (id: string) => Promise<string>,
  progress: (value: ExportProgress) => void,
  signal: AbortSignal,
  surface?: HTMLCanvasElement,
): Promise<MovieResult> {
  const format = browserRecordingFormat();
  if (!format)
    throw new Error(
      "This browser cannot run the local encoder. Open a portable project in Corto for desktop.",
    );
  if (format.extension === "webm")
    return renderRecorderMovie(request, assetUrl, progress, signal, surface);
  const { renderWasmMovie } = await import("./wasm-renderer");
  return renderWasmMovie(request, assetUrl, progress, signal);
}
