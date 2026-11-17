/// <reference lib="webworker" />
import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";
import {
  LOCAL_MODELS,
  type ModelJob,
  type ModelProgress,
  type ModelResult,
  type TranscriptChunk,
} from "./catalogue";
import { modelCache } from "./cache";
import { removeBackground } from "./remove-background";

const scope = self as unknown as DedicatedWorkerGlobalScope;
env.allowLocalModels = false;
env.useFSCache = false;
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = modelCache;
env.logLevel = 50;
if (!env.backends.onnx.wasm)
  throw new Error("The local WASM runtime is unavailable");
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let speechEngine: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function progress(value: ProgressInfo): void {
  const fraction =
    value.status === "progress" && "progress" in value
      ? value.progress / 100
      : null;
  const message =
    value.status === "progress"
      ? "Downloading the local model"
      : value.status === "ready"
        ? "Processing on this device"
        : "Preparing the local model";
  scope.postMessage({
    progress: { message, fraction } satisfies ModelProgress,
  });
}

/** All remote reads are public, revision-pinned model data. Media is supplied directly as local blobs/samples. */
async function run(job: ModelJob, wasmBase: string): Promise<ModelResult> {
  const model = LOCAL_MODELS[job.kind];
  const prefix = `https://huggingface.co/${model.id}/resolve/${model.revision}/`;
  env.remotePathTemplate = `{model}/resolve/${model.revision}/`;
  const fetchData = globalThis.fetch.bind(globalThis);
  env.fetch = (input, init) => {
    const url = String(input);
    if (
      !url.startsWith(prefix) ||
      (init?.method && !["GET", "HEAD"].includes(init.method))
    )
      throw new Error(
        `Only pinned public model data may be downloaded: ${new URL(url).pathname}`,
      );
    return fetchData(url, {
      ...init,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  };
  if (job.kind === "background") {
    return {
      image: await removeBackground(job.image, wasmBase, (url) =>
        env.fetch!(url),
      ),
    };
  }
  speechEngine ??= pipeline("automatic-speech-recognition", model.id, {
    revision: model.revision,
    dtype: "q8",
    device: "wasm",
    progress_callback: progress,
  });
  const recognizer = await speechEngine;
  const output = await recognizer(job.samples, {
    return_timestamps: true,
    language: job.language,
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 0,
  });
  const result = Array.isArray(output) ? output[0] : output;
  return { chunks: (result.chunks ?? []) as TranscriptChunk[] };
}
scope.onmessage = (
  event: MessageEvent<{ job: ModelJob; wasmBase: string }>,
) => {
  env.backends.onnx.wasm!.wasmPaths = event.data.wasmBase;
  void run(event.data.job, event.data.wasmBase)
    .then((result) => scope.postMessage({ result }))
    .catch((error) =>
      scope.postMessage({
        error:
          error instanceof Error
            ? error.message
            : "The local model could not finish",
      }),
    );
};
