import { BROWSER_CONVERSION_BYTES } from "./phone-plan";

/** Give one local job an owned WASM filesystem and terminate it on completion or cancellation. */
export async function localCodec<T>(
  file: Blob,
  name: string,
  signal: AbortSignal,
  operation: (
    codec: import("@ffmpeg/ffmpeg").FFmpeg,
    source: string,
  ) => Promise<T>,
): Promise<T> {
  if (file.size > BROWSER_CONVERSION_BYTES)
    throw new Error(
      "For media larger than 256 MB, use Corto for desktop. Your original is unchanged.",
    );
  signal.throwIfAborted();
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const codec = new FFmpeg();
  const cancel = () => codec.terminate();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const base = new URL(
      `${import.meta.env.BASE_URL}codecs/ffmpeg/`,
      document.baseURI,
    ).href;
    await codec.load({
      classWorkerURL: `${base}worker.js`,
      coreURL: `${base}ffmpeg-core.js`,
      wasmURL: `${base}ffmpeg-core.wasm`,
    });
    const source = `source.${
      name
        .split(".")
        .at(-1)
        ?.replace(/[^a-z0-9]/gi, "") || "bin"
    }`;
    await codec.writeFile(source, new Uint8Array(await file.arrayBuffer()));
    signal.throwIfAborted();
    return await operation(codec, source);
  } finally {
    signal.removeEventListener("abort", cancel);
    codec.terminate();
  }
}

/** Return a detached binary output from the local codec's temporary filesystem. */
export async function codecBytes(
  codec: import("@ffmpeg/ffmpeg").FFmpeg,
  path: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const value = await codec.readFile(path);
  if (!(value instanceof Uint8Array))
    throw new Error("The local media output is incomplete");
  return new Uint8Array(value);
}
