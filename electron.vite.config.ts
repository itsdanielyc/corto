// One config for the three Electron builds. The layout mirrors the Tauri
// template: the renderer is the Vite app at the root (index.html, src/), and
// the native side lives in electron/ the way Rust lives in src-tauri/.
import { resolve } from "node:path";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      lib: { entry: resolve(import.meta.dirname, "electron/main.ts") },
    },
  },
  preload: {
    build: {
      lib: { entry: resolve(import.meta.dirname, "electron/preload.ts") },
      // A sandboxed preload must be CommonJS; the package is "type": "module",
      // so the file gets a .cjs extension.
      rolldownOptions: {
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    optimizeDeps: {
      include: [
        "webm-duration-fix/lib/ebml/index.js",
        "@ffmpeg/ffmpeg",
        "libheif-js/libheif-wasm/libheif-bundle.mjs",
      ],
    },
    resolve: {
      conditions: [
        "onnxruntime-web-use-extern-wasm",
        "module",
        "browser",
        "development|production",
      ],
      alias: [
        { find: /^buffer$/, replacement: "buffer/" },
        { find: /^events$/, replacement: "events/" },
      ],
    },
    root: ".",
    server: { port: 1420, strictPort: true },
    build: {
      minify: true,
      rolldownOptions: { input: resolve(import.meta.dirname, "index.html") },
    },
  },
});
