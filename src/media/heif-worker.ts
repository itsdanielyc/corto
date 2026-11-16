import createModule from "libheif-js/libheif-wasm/libheif-bundle.mjs";
import { MAX_PHOTO_PIXELS } from "./phone-plan";

/** Decode in a disposable worker so a large HEIF never freezes the editor's input thread. */
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const library = await createModule();
    const images = new library.HeifDecoder().decode(new Uint8Array(event.data));
    const image = images[0];
    if (!image) throw new Error("The HEIC photo could not be decoded");
    const width = image.get_width();
    const height = image.get_height();
    if (width <= 0 || height <= 0 || width * height > MAX_PHOTO_PIXELS)
      throw new Error("This HEIC photo exceeds the 64 megapixel import limit");
    const pixels = new ImageData(width, height);
    await new Promise<void>((resolve, reject) =>
      image.display(pixels, (result) =>
        result ? resolve() : reject(new Error("The HEIC photo is incomplete")),
      ),
    );
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This device cannot convert HEIC photos");
    context.putImageData(pixels, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "The HEIC photo could not be opened",
    });
  }
};
