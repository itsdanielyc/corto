import { localCodec, codecBytes } from "./local-codec";

/** Rasterise selected vector art without scripts/external resources; retain its untouched source separately. */
export async function convertSvgPicture(file: File): Promise<File> {
  if (file.size > 16 * 1024 ** 2)
    throw new Error("Choose an SVG smaller than 16 MB");
  const text = await file.text();
  const parsedSvg = new DOMParser().parseFromString(text, "image/svg+xml");
  if (
    parsedSvg.querySelector("parsererror,script,foreignObject,iframe") ||
    /(?:url\s*\(\s*["']?\s*(?:https?:|file:|\/\/)|@import|<!ENTITY)/i.test(
      text,
    ) ||
    [...parsedSvg.querySelectorAll("*")].some((element) =>
      [...element.attributes].some(
        (attribute) =>
          attribute.localName === "href" &&
          !attribute.value.startsWith("#") &&
          !/^data:image\/(png|jpeg|webp);/i.test(attribute.value),
      ),
    )
  )
    throw new Error(
      "Use a self-contained SVG without scripts or external resources",
    );
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      4096 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas
      .getContext("2d")!
      .drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("The SVG could not be converted")),
        "image/png",
      ),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, ".png"), {
      type: "image/png",
    });
  } finally {
    image.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

/** Use the bundled TIFF decoder where a browser cannot decode the original directly. */
export async function convertTiffPicture(file: File): Promise<File> {
  return localCodec(
    file,
    file.name,
    new AbortController().signal,
    async (codec, source) => {
      if (await codec.exec(["-i", source, "-frames:v", "1", "compatible.png"]))
        throw new Error("This TIFF could not be converted locally");
      return new File(
        [await codecBytes(codec, "compatible.png")],
        file.name.replace(/\.[^.]+$/, ".png"),
        { type: "image/png" },
      );
    },
  );
}
