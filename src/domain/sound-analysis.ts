export interface SoundAnalysis {
  peaks: number[];
  beats: number[];
}
// Time O(samples), space O(buckets + detected onsets). A fixed energy window avoids per-sample allocations.
export function analyseSound(
  samples: Float32Array,
  sampleRate: number,
  buckets = 128,
): SoundAnalysis {
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    !Number.isInteger(buckets) ||
    buckets <= 0
  )
    throw new Error("Invalid audio analysis dimensions");
  const peaks = Array<number>(buckets).fill(0);
  const beats: number[] = [];
  const window = Math.max(1, Math.round(sampleRate * 0.02));
  let previousEnergy = 0;
  let lastBeat = -Infinity;
  for (let start = 0; start < samples.length; start += window) {
    let squared = 0;
    const end = Math.min(samples.length, start + window);
    for (let index = start; index < end; index++) {
      const sample = Number.isFinite(samples[index]) ? samples[index] : 0;
      squared += sample * sample;
      const bucket = Math.min(
        buckets - 1,
        Math.floor((index / samples.length) * buckets),
      );
      peaks[bucket] = Math.max(peaks[bucket], Math.abs(sample));
    }
    const energy = Math.sqrt(squared / (end - start));
    const time = start / sampleRate;
    if (
      energy > 0.01 &&
      energy > previousEnergy * 1.8 &&
      time - lastBeat >= 0.24
    ) {
      beats.push(time);
      lastBeat = time;
    }
    previousEnergy = previousEnergy * 0.85 + energy * 0.15;
  }
  return { peaks, beats };
}

interface LaneEnd {
  end: number;
  lane: number;
}
function pushLane(heap: LaneEnd[], value: LaneEnd): void {
  heap.push(value);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].end <= value.end) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = value;
}
function popLane(heap: LaneEnd[]): LaneEnd {
  const first = heap[0];
  const last = heap.pop()!;
  if (!heap.length) return first;
  let index = 0;
  while (index * 2 + 1 < heap.length) {
    let child = index * 2 + 1;
    if (child + 1 < heap.length && heap[child + 1].end < heap[child].end)
      child++;
    if (heap[child].end >= last.end) break;
    heap[index] = heap[child];
    index = child;
  }
  heap[index] = last;
  return first;
}

// Time O(clips log clips), space O(clips). Earliest-ending lanes are reused without scanning every track.
export function packSoundLanes<
  T extends { id: string; start: number; duration: number },
>(clips: readonly T[]): { clip: T; lane: number }[] {
  const heap: LaneEnd[] = [];
  let count = 0;
  return [...clips]
    .sort((a, b) => a.start - b.start)
    .map((clip) => {
      const lane = heap[0]?.end <= clip.start ? popLane(heap).lane : count++;
      pushLane(heap, { end: clip.start + clip.duration, lane });
      return { clip, lane };
    });
}
