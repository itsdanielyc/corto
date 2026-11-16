import * as ebml from "webm-duration-fix/lib/ebml/index.js";

// Time O(recording bytes), space O(one stream chunk + metadata + seek cues).
/** Stream a recording and index only clusters that can actually be decoded independently. */
export async function finalizeWebmMetadata(blob: Blob): Promise<Blob> {
  const fallback = ebml as unknown as { default?: typeof ebml };
  const api = typeof ebml.Decoder === "function" ? ebml : fallback.default;
  if (!api) throw new Error("The WebM parser could not be loaded");
  const decoder = new api.Decoder();
  const reader = new api.Reader();
  const seekableClusters = new Set<number>();
  const stream = blob.stream().getReader();
  let clusterPosition = -1;
  let firstVideoRead = false;
  try {
    while (true) {
      const chunk = await stream.read();
      if (chunk.done) break;
      const bytes = chunk.value;
      const buffer =
        bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
          ? bytes.buffer
          : bytes.slice().buffer;
      for (const element of decoder.decode(buffer)) {
        if (element.type === "unknown") continue;
        if (
          element.type === "m" &&
          element.name === "Cluster" &&
          !element.isEnd
        ) {
          clusterPosition = element.tagStart;
          firstVideoRead = false;
        }
        reader.read(element);
        if (
          element.type !== "b" ||
          element.name !== "SimpleBlock" ||
          firstVideoRead ||
          reader.trackInfo.type === "nothing" ||
          reader.trackInfo.type === "audio"
        )
          continue;
        const block = api.tools.ebmlBlock(element.data);
        if (block.trackNumber !== reader.trackInfo.trackNumber) continue;
        firstVideoRead = true;
        // A timeslice can start with an interframe; indexing it produces corrupt fast seeks.
        if (block.keyframe) seekableClusters.add(clusterPosition);
      }
    }
    reader.stop();
  } finally {
    stream.releaseLock();
  }
  const cues = reader.cues.filter((cue) =>
    seekableClusters.has(cue.CueClusterPosition),
  );
  if (!cues.length)
    throw new Error("The browser recording contains no seekable video frame");
  const metadata = api.tools.makeMetadataSeekable(
    reader.metadatas,
    reader.duration,
    cues,
  );
  return new Blob([metadata, blob.slice(reader.metadataSize)], {
    type: blob.type,
  });
}
