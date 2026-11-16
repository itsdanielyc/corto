import fixWebmDuration from "webm-duration-fix";

type WebmFinalizer = (blob: Blob) => Promise<Blob>;
// The CommonJS package has a nested default in Vite's development-worker build.
const entry = fixWebmDuration as unknown as
  WebmFinalizer | { default: WebmFinalizer };
const finalize = typeof entry === "function" ? entry : entry.default;
if (typeof finalize !== "function")
  throw new Error("The WebM finalizer could not be loaded");

/** Stream the recording through an EBML finalizer away from the editor's main thread. */
addEventListener("message", (event: MessageEvent<Blob>) => {
  void finalize(event.data)
    .then((blob) => postMessage({ ok: true, blob }))
    .catch((error) =>
      postMessage({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "WebM metadata could not be finalized",
      }),
    );
});
