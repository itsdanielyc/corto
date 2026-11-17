import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";

const destination = resolve("public/codecs/ffmpeg");
await mkdir(destination, { recursive: true });
await cp(resolve("node_modules/@ffmpeg/ffmpeg/dist/esm"), destination, {
  recursive: true,
  filter: (path) => !path.endsWith(".d.ts"),
});
await cp(
  resolve("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js"),
  resolve(destination, "ffmpeg-core.js"),
);
await cp(
  resolve("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm"),
  resolve(destination, "ffmpeg-core.wasm"),
);
await cp(
  resolve("node_modules/libheif-js/LICENSE"),
  resolve("public/licenses/libheif-js-LICENSE.txt"),
);
const onnxDestination = resolve("public/codecs/onnx");
await mkdir(onnxDestination, { recursive: true });
const onnxFiles = new Set([
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
]);
for (const file of await readdir(onnxDestination)) {
  if (!file.startsWith("ort-wasm-") || onnxFiles.has(file)) continue;
  const path = resolve(onnxDestination, file);
  const inside = relative(onnxDestination, path);
  if (inside.startsWith("..") || inside.includes(":"))
    throw new Error("A generated runtime path left its owned directory");
  await rm(path);
}
for (const name of onnxFiles)
  await cp(
    resolve("node_modules/onnxruntime-web/dist", name),
    resolve(onnxDestination, name),
  );
await cp(
  resolve("node_modules/@huggingface/transformers/LICENSE"),
  resolve("public/licenses/transformers-js-LICENSE.txt"),
);
// ONNX's published web package omits its license file; the pinned upstream MIT text is tracked in public/licenses.
