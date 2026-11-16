import { finalizeWebmMetadata } from "./webm-metadata";

/** Finalize recording metadata in a worker so large movies cannot block the editor. */
addEventListener("message", (event: MessageEvent<Blob>) => {
  void finalizeWebmMetadata(event.data)
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
