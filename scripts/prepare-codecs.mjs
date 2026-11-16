import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

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
