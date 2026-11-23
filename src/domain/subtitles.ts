import { LIMITS, subtitleSchema, type Subtitle } from "../../contracts/project";

const TIMESTAMP = /^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})$/;

function parseTime(value: string): number {
  const match = TIMESTAMP.exec(value);
  if (!match || Number(match[2]) >= 60 || Number(match[3]) >= 60)
    throw new Error("A subtitle timestamp is invalid");
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  );
}

/** Reject ambiguous overlap rather than silently hiding a person's subtitles. */
export function validateSubtitles(input: readonly Subtitle[]): Subtitle[] {
  if (input.length > LIMITS.subtitles)
    throw new Error(`Keep subtitles within ${LIMITS.subtitles} cues`);
  let previousEnd = 0;
  const identifiers = new Set<string>();
  return input.map((value) => {
    const cue = subtitleSchema.parse(value);
    if (cue.end <= cue.start)
      throw new Error("A subtitle must end after it starts");
    if (cue.start < previousEnd)
      throw new Error("Subtitles must be ordered without overlap");
    if (identifiers.has(cue.id))
      throw new Error("Subtitle identifiers must be unique");
    identifiers.add(cue.id);
    previousEnd = cue.end;
    return cue;
  });
}

// Time O(characters + cues log cues), space O(characters + cues); input size is bounded before parsing.
/** Import plain text SRT with BOM/CRLF support; formatting tags never become executable markup. */
export function parseSrt(text: string): Subtitle[] {
  if (text.length > 512 * 1024)
    throw new Error("This subtitle file is too large");
  const blocks = text
    .replace(/^\uFEFF/, "")
    .replaceAll("\r\n", "\n")
    .trim()
    .split(/\n\s*\n/);
  const cues = blocks.map((block) => {
    const lines = block.split("\n");
    const timingIndex = /^\d+$/.test(lines[0].trim()) ? 1 : 0;
    const timing = /^(\S+)\s+-->\s+(\S+)\s*$/.exec(lines[timingIndex] ?? "");
    if (!timing)
      throw new Error("Use an SRT file with start --> end timestamps");
    return {
      id: crypto.randomUUID(),
      start: parseTime(timing[1]),
      end: parseTime(timing[2]),
      text: lines
        .slice(timingIndex + 1)
        .join("\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?(?:b|i|u|s|font)\b[^>]*>/gi, "")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&")
        .trim(),
    };
  });
  cues.sort((a, b) => a.start - b.start);
  return validateSubtitles(cues);
}

function formatSrtTime(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000);
  return `${String(Math.floor(milliseconds / 3_600_000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60_000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")},${String(milliseconds % 1000).padStart(3, "0")}`;
}

/** Preserve Unicode and deliberate line breaks in a portable subtitle sidecar. */
function encodeCueText(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  // A blank line ends an SRT cue. Represent its line breaks inside the cue instead.
  return /\n\s*\n/.test(escaped) ? escaped.replaceAll("\n", "<br>") : escaped;
}

export function serializeSrt(cues: readonly Subtitle[]): string {
  return (
    validateSubtitles(cues)
      .map(
        (cue, index) =>
          `${index + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${encodeCueText(cue.text)}`,
      )
      .join("\n\n") + "\n"
  );
}

// Time O(log cues), space O(1); callers supply ordered, non-overlapping cues.
/** Locate a cue using half-open timing so adjacent subtitles never appear together. */
export function subtitleAt(
  cues: readonly Subtitle[],
  time: number,
): Subtitle | null {
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const cue = cues[middle];
    if (time < cue.start) high = middle - 1;
    else if (time >= cue.end) low = middle + 1;
    else return cue;
  }
  return null;
}
