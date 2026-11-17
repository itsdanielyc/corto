import type { ModelJob, ModelProgress, ModelResult } from "./catalogue";

/** One bounded inference session reuses model weights across a long film's small audio windows. */
export class LocalModelSession {
  private readonly worker = new Worker(
    new URL("./model-worker.ts", import.meta.url),
    { type: "module" },
  );
  private pending: {
    resolve: (result: ModelResult) => void;
    reject: (reason: unknown) => void;
  } | null = null;
  private readonly cancel: () => void;
  constructor(
    private readonly signal: AbortSignal,
    progress: (progress: ModelProgress) => void,
  ) {
    this.cancel = () => {
      this.pending?.reject(
        signal.reason ?? new Error("Local processing cancelled"),
      );
      this.pending = null;
      this.worker.terminate();
    };
    signal.addEventListener("abort", this.cancel, { once: true });
    this.worker.onmessage = (
      event: MessageEvent<{
        result?: ModelResult;
        progress?: ModelProgress;
        error?: string;
      }>,
    ) => {
      if (event.data.progress) {
        progress(event.data.progress);
        return;
      }
      const pending = this.pending;
      this.pending = null;
      if (event.data.error) pending?.reject(new Error(event.data.error));
      else if (event.data.result) pending?.resolve(event.data.result);
    };
    this.worker.onerror = (event) => {
      this.pending?.reject(
        new Error(event.message || "The local model worker could not start"),
      );
      this.pending = null;
    };
  }
  run(job: ModelJob): Promise<ModelResult> {
    this.signal.throwIfAborted();
    if (this.pending)
      throw new Error("Finish the current local model operation first");
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.worker.postMessage(
        {
          job,
          wasmBase: new URL(
            `${import.meta.env.BASE_URL}codecs/onnx/`,
            document.baseURI,
          ).href,
        },
        job.kind === "speech" ? [job.samples.buffer] : [],
      );
    });
  }
  dispose(): void {
    this.signal.removeEventListener("abort", this.cancel);
    this.cancel();
  }
}
export async function runLocalModel(
  job: ModelJob,
  signal: AbortSignal,
  progress: (progress: ModelProgress) => void,
): Promise<ModelResult> {
  const session = new LocalModelSession(signal, progress);
  try {
    return await session.run(job);
  } finally {
    session.dispose();
  }
}
