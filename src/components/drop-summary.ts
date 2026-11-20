type Translate = (text: string) => string;

/**
 * Names what a drag will add ("Drop to add 12 photos and 2 clips") from the
 * item types the browser exposes during dragenter. Files without a type
 * (HEIC on some systems) count as files. O(n) for n dragged items.
 */
export function describeDrop(items: DataTransferItemList, t: Translate) {
  const counts = { photo: 0, clip: 0, song: 0, file: 0 };
  for (const item of Array.from(items)) {
    if (item.kind !== "file") continue;
    if (item.type.startsWith("image/")) counts.photo++;
    else if (item.type.startsWith("video/")) counts.clip++;
    else if (item.type.startsWith("audio/")) counts.song++;
    else counts.file++;
  }
  const parts = (
    [
      ["photo", "photos"],
      ["clip", "clips"],
      ["song", "songs"],
      ["file", "files"],
    ] as const
  )
    .filter(([key]) => counts[key] > 0)
    .map(
      ([key, plural]) =>
        `${counts[key]} ${t(counts[key] === 1 ? key : plural)}`,
    );
  if (!parts.length) return "";
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} ${t("and")} ${parts.at(-1)}`;
  return `${t("Drop to add")} ${list}`;
}
