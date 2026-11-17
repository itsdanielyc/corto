import { InferenceSession, Tensor, env } from "onnxruntime-web/wasm";
import { RawImage } from "@huggingface/transformers";
import { LOCAL_MODELS } from "./catalogue";
import { modelCache } from "./cache";

const INPUT_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const DEVIATION = [0.229, 0.224, 0.225];

// Time O(input pixels + output pixels), space O(a small inference graph + one image/matte).
/** The upstream U²-Net-small contract uses 320px RGB planes and min/max-normalised foreground scores. */
export async function removeBackground(
  imageBlob: Blob,
  wasmBase: string,
  read: (url: string) => Promise<Response>,
): Promise<Blob> {
  env.wasm.numThreads = 1;
  env.wasm.proxy = false;
  env.wasm.wasmPaths = {
    mjs: `${wasmBase}ort-wasm-simd-threaded.mjs`,
    wasm: `${wasmBase}ort-wasm-simd-threaded.wasm`,
  };
  const model = LOCAL_MODELS.background;
  const url = `https://huggingface.co/${model.id}/resolve/${model.revision}/u2netp.onnx`;
  let response = await modelCache.match(url);
  if (!response) {
    response = await read(url);
    if (!response.ok)
      throw new Error("The local background model could not be downloaded");
    await modelCache.put(url, response.clone());
  }
  const bytes = await response.arrayBuffer();
  const digest = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== model.sha256)
    throw new Error(
      "The background model did not match its published checksum",
    );
  const session = await InferenceSession.create(bytes, {
    executionProviders: ["wasm"],
  });
  try {
    const original = await RawImage.fromBlob(imageBlob);
    const small = await original.clone().rgb().resize(INPUT_SIZE, INPUT_SIZE);
    const pixels = INPUT_SIZE ** 2;
    const data = new Float32Array(pixels * 3);
    let maximum = 1;
    for (const value of small.data) maximum = Math.max(maximum, value);
    for (let index = 0; index < pixels; index++)
      for (let channel = 0; channel < 3; channel++)
        data[channel * pixels + index] =
          (small.data[index * 3 + channel] / maximum - MEAN[channel]) /
          DEVIATION[channel];
    const outputs = await session.run({
      [session.inputNames[0]]: new Tensor("float32", data, [
        1,
        3,
        INPUT_SIZE,
        INPUT_SIZE,
      ]),
    });
    const prediction = outputs[session.outputNames[0]].data;
    if (!(prediction instanceof Float32Array) || prediction.length !== pixels)
      throw new Error("The local background model returned an invalid matte");
    let minimum = Infinity;
    let upper = -Infinity;
    for (const value of prediction) {
      minimum = Math.min(minimum, value);
      upper = Math.max(upper, value);
    }
    const alpha = new Uint8Array(pixels);
    const span = upper - minimum;
    for (let index = 0; index < pixels; index++)
      alpha[index] =
        span > 0.000001
          ? Math.round(((prediction[index] - minimum) / span) * 255)
          : 255;
    const mask = await new RawImage(alpha, INPUT_SIZE, INPUT_SIZE, 1).resize(
      original.width,
      original.height,
    );
    if (original.channels === 4)
      for (let index = 0; index < mask.data.length; index++)
        mask.data[index] = Math.round(
          (mask.data[index] * original.data[index * 4 + 3]) / 255,
        );
    return (await original.rgba().putAlpha(mask).toBlob("image/png")) as Blob;
  } finally {
    await session.release();
  }
}
