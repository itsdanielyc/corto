import { EXPORT_FPS } from "../../contracts/project";

const SEEK_TIMEOUT_MS = 10_000;

/** Wait for the requested decoded video frame, with explicit cancellation and cleanup. */
export function seekVideo(
  video: HTMLVideoElement,
  requested: number,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const time = Math.max(
    0,
    Math.min(requested, Math.max(0, video.duration - 1 / EXPORT_FPS)),
  );
  if (
    Math.abs(video.currentTime - time) < 0.015 &&
    !video.seeking &&
    video.readyState >= 2
  )
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("This video frame could not be decoded"));
    };
    const aborted = () => {
      cleanup();
      reject(signal?.reason ?? new DOMException("Cancelled", "AbortError"));
    };
    const timer = window.setTimeout(failed, SEEK_TIMEOUT_MS);
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", aborted, { once: true });
    try {
      video.currentTime = time;
    } catch {
      failed();
    }
  });
}
