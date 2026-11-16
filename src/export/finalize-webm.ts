type FinalizerMessage =
  { ok: true; blob: Blob } | { ok: false; message: string };

/** Supply seekable WebM metadata without copying the whole recording into the UI thread. */
export function finalizeWebm(blob: Blob, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./webm-worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      cleanup();
      reject(signal.reason);
    };
    worker.onmessage = (event: MessageEvent<FinalizerMessage>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.blob);
      else reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      console.error("WebM finalizer worker failed:", event.message);
      cleanup();
      reject(
        new Error(
          "WebM metadata could not be finalized. Try the desktop app for MP4 export.",
        ),
      );
    };
    signal.addEventListener("abort", cancel, { once: true });
    worker.postMessage(blob);
  });
}
