import {
  LIMITS,
  mediaAssetSchema,
  type MediaAsset,
} from "../../contracts/project";

const LOAD_TIMEOUT_MS = 15_000;
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 200;
const extensionMimes: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  bmp: "image/bmp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
};
export type VisualMedia = HTMLImageElement | HTMLVideoElement;

/** Await local decoding, cleaning up listeners and rejecting unsupported codecs visibly. */
export function waitForMedia(
  media: HTMLMediaElement,
  data = true,
): Promise<void> {
  const targetState = data
    ? HTMLMediaElement.HAVE_CURRENT_DATA
    : HTMLMediaElement.HAVE_METADATA;
  if (media.readyState >= targetState) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const event = data ? "loadeddata" : "loadedmetadata";
    const cleanup = () => {
      window.clearTimeout(timer);
      media.removeEventListener(event, loaded);
      media.removeEventListener("error", failed);
    };
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(
        new Error(
          "This file cannot be played here. Try MP4 video with H.264, or MP3/WAV audio.",
        ),
      );
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "This media took too long to open. Check that the original is complete and stored on this device.",
        ),
      );
    }, LOAD_TIMEOUT_MS);
    media.addEventListener(event, loaded, { once: true });
    media.addEventListener("error", failed, { once: true });
  });
}

/** Release decoded video buffers and stop audio before discarding a media element. */
export function disposeMedia(media: HTMLMediaElement | HTMLImageElement): void {
  if (media instanceof HTMLMediaElement) {
    media.pause();
    media.removeAttribute("src");
    media.load();
  } else media.removeAttribute("src");
}

export function thumbnail(media: VisualMedia): string {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This device cannot create a preview");
  const width =
    media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const height =
    media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  const scale = Math.max(canvas.width / width, canvas.height / height);
  context.drawImage(
    media,
    (canvas.width - width * scale) / 2,
    (canvas.height - height * scale) / 2,
    width * scale,
    height * scale,
  );
  return canvas.toDataURL("image/jpeg", 0.76);
}

/** Probe the browser's actual decoder before committing an original to the local workspace. */
export async function inspectFile(
  file: File,
): Promise<{ asset: MediaAsset; poster: string | null }> {
  if (!file.size) throw new Error(`${file.name} is empty`);
  if (file.size > LIMITS.assetBytes)
    throw new Error(`${file.name} exceeds the 2 GB per-file limit`);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = extensionMimes[extension] ?? file.type;
  const kind = mime.startsWith("image/")
    ? "image"
    : mime.startsWith("video/")
      ? "video"
      : mime.startsWith("audio/")
        ? "audio"
        : null;
  if (!kind || !Object.values(extensionMimes).includes(mime))
    throw new Error(
      `${file.name} is not supported. Use JPG, PNG, WebP, MP4, MOV, WebM, MP3, WAV, M4A or FLAC.`,
    );
  const url = URL.createObjectURL(file);
  const element =
    kind === "image"
      ? new Image()
      : document.createElement(kind === "audio" ? "audio" : "video");
  try {
    element.crossOrigin = "anonymous";
    element.src = url;
    if (element instanceof HTMLImageElement) await element.decode();
    else {
      element.preload = "auto";
      await waitForMedia(element, kind === "video");
    }
    const width =
      element instanceof HTMLImageElement
        ? element.naturalWidth
        : element instanceof HTMLVideoElement
          ? element.videoWidth
          : 0;
    const height =
      element instanceof HTMLImageElement
        ? element.naturalHeight
        : element instanceof HTMLVideoElement
          ? element.videoHeight
          : 0;
    const duration = element instanceof HTMLMediaElement ? element.duration : 0;
    const asset = mediaAssetSchema.parse({
      id: crypto.randomUUID(),
      name: file.name,
      kind,
      mime,
      size: file.size,
      width,
      height,
      duration,
    });
    return {
      asset,
      poster: kind === "audio" ? null : thumbnail(element as VisualMedia),
    };
  } catch (error) {
    if (error instanceof Error && error.message)
      throw new Error(`${file.name}: ${error.message}`);
    throw new Error(
      `${file.name} could not be decoded. Try a different format.`,
    );
  } finally {
    disposeMedia(element);
    URL.revokeObjectURL(url);
  }
}

/** Rebuild a small library poster from a locally persisted original. */
export async function posterFromUrl(
  asset: MediaAsset,
  url: string,
): Promise<string | null> {
  if (asset.kind === "audio") return null;
  const element =
    asset.kind === "image" ? new Image() : document.createElement("video");
  try {
    element.crossOrigin = "anonymous";
    element.src = url;
    if (element instanceof HTMLImageElement) await element.decode();
    else {
      element.muted = true;
      element.preload = "auto";
      await waitForMedia(element);
    }
    return thumbnail(element);
  } finally {
    disposeMedia(element);
  }
}
