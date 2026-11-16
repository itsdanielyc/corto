import type { ImportedMedia } from "../../contracts/platform";
import type { CortoPlatform } from "../platform/types";
import { inspectFile } from "./import";
import {
  BROWSER_CONVERSION_BYTES,
  needsPhoneConversion,
  phoneVideoArguments,
} from "./phone-plan";

async function decodeHeif(file: File): Promise<File> {
  if (file.size > BROWSER_CONVERSION_BYTES)
    throw new Error("This HEIC photo is too large to convert safely");
  const worker = new Worker(new URL("./heif-worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      worker.onmessage = (
        event: MessageEvent<{ blob?: Blob; error?: string }>,
      ) =>
        event.data.blob
          ? resolve(event.data.blob)
          : reject(new Error(event.data.error));
      worker.onerror = () =>
        reject(new Error("The local HEIC decoder could not start"));
      void file
        .arrayBuffer()
        .then((bytes) => worker.postMessage(bytes, [bytes]), reject);
    });
    return new File([blob], file.name.replace(/\.[^.]+$/, ".png"), {
      type: "image/png",
    });
  } finally {
    worker.terminate();
  }
}

async function convertBrowserVideo(file: File): Promise<File> {
  if (file.size > BROWSER_CONVERSION_BYTES)
    throw new Error(
      "For phone videos larger than 256 MB, use Corto for desktop. The original is unchanged.",
    );
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const converter = new FFmpeg();
  const base = new URL(
    `${import.meta.env.BASE_URL}codecs/ffmpeg/`,
    document.baseURI,
  ).href;
  let diagnostic = "";
  converter.on("log", ({ message }) => {
    diagnostic = (diagnostic + message + "\n").slice(-16000);
  });
  try {
    await converter.load({
      classWorkerURL: `${base}worker.js`,
      coreURL: `${base}ffmpeg-core.js`,
      wasmURL: `${base}ffmpeg-core.wasm`,
    });
    await converter.writeFile(
      "source.mov",
      new Uint8Array(await file.arrayBuffer()),
    );
    await converter.exec(["-hide_banner", "-i", "source.mov"]);
    const hdr = /bt2020|smpte2084|arib-std-b67/.test(diagnostic);
    const result = await converter.exec(
      phoneVideoArguments("source.mov", "compatible.mp4", hdr),
    );
    if (result !== 0)
      throw new Error(
        "This phone video could not be converted locally. Try the desktop app; the original is unchanged.",
      );
    const bytes = await converter.readFile("compatible.mp4");
    if (!(bytes instanceof Uint8Array))
      throw new Error("The compatible phone video is incomplete");
    return new File(
      [bytes as Uint8Array<ArrayBuffer>],
      file.name.replace(/\.[^.]+$/, ".mp4"),
      { type: "video/mp4" },
    );
  } finally {
    converter.terminate();
  }
}

/** Store the untouched phone original alongside a linked, portable compatibility copy. */
export async function importMedia(
  file: File,
  platform: CortoPlatform,
): Promise<ImportedMedia> {
  const heif = /\.(heic|heif)$/i.test(file.name);
  const phoneVideo = !heif && (await needsPhoneConversion(file));
  if (phoneVideo && platform.importPhoneVideo)
    return platform.importPhoneVideo(file);
  const compatible = heif
    ? await decodeHeif(file)
    : phoneVideo
      ? await convertBrowserVideo(file)
      : file;
  const { asset } = await inspectFile(compatible);
  if (compatible === file) {
    await platform.putAsset(asset, file);
    return { asset };
  }
  const original = {
    ...asset,
    id: crypto.randomUUID(),
    name: file.name,
    mime: heif
      ? /\.heif$/i.test(file.name)
        ? "image/heif"
        : "image/heic"
      : /\.mov$/i.test(file.name)
        ? "video/quicktime"
        : /\.m4v$/i.test(file.name)
          ? "video/x-m4v"
          : "video/mp4",
    size: file.size,
    isOriginalOnly: true,
  };
  const playback = { ...asset, name: file.name, originalAssetId: original.id };
  await platform.putAsset(original, file);
  await platform.putAsset(playback, compatible);
  return { asset: playback, original };
}
