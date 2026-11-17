import type { MediaAsset } from "../../contracts/project";

/** Read capture metadata locally; absent/malformed EXIF falls back to the selected file's timestamp. */
export async function captureMetadata(
  file: File,
): Promise<Pick<MediaAsset, "capturedAt" | "fileDate" | "camera">> {
  const result: Pick<MediaAsset, "capturedAt" | "fileDate" | "camera"> = {};
  if (file.lastModified > 0 && Number.isFinite(file.lastModified))
    result.fileDate = new Date(file.lastModified).toISOString();
  if (!/\.(jpe?g|heic|heif|tiff?)$/i.test(file.name)) return result;
  try {
    const { parse } = await import("exifr");
    const metadata = await parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "Make", "Model"],
    });
    const date = metadata?.DateTimeOriginal ?? metadata?.CreateDate;
    if (date instanceof Date && Number.isFinite(date.getTime()))
      result.capturedAt = date.toISOString();
    const camera = [metadata?.Make, metadata?.Model]
      .filter((value) => typeof value === "string")
      .join(" ")
      .trim();
    if (camera) result.camera = camera.slice(0, 160);
  } catch {
    /* A corrupt optional EXIF block must not prevent a valid picture from importing. */
  }
  return result;
}
