import type { MediaAsset, Project } from "../../contracts/project";
import type { CortoPlatform } from "../platform/types";
import { analyseSound, type SoundAnalysis } from "../domain/sound-analysis";

const cache = new Map<string, Promise<SoundAnalysis>>();
let queue = Promise.resolve();
/** Analyse long recordings in small serial windows, caching only compact peaks and onset times. */
export function soundAnalysis(
  platform: CortoPlatform,
  project: Project,
  asset: MediaAsset,
): Promise<SoundAnalysis> {
  const existing = cache.get(asset.id);
  if (existing) return existing;
  const operation = queue.then(async () => {
    if (!platform.audioSamples)
      throw new Error("Audio analysis is unavailable in this build");
    const peaks = Array<number>(128).fill(0);
    const beats: number[] = [];
    for (let start = 0; start < asset.duration; start += 30) {
      const duration = Math.min(30, asset.duration - start);
      const samples = await platform.audioSamples(project, {
        assetId: asset.id,
        start,
        duration,
        speed: 1,
        preservePitch: true,
      });
      const analysis = analyseSound(samples, 16000);
      analysis.peaks.forEach((peak, index) => {
        const bucket = Math.min(
          127,
          Math.floor(
            ((start + (index / 128) * duration) / asset.duration) * 128,
          ),
        );
        peaks[bucket] = Math.max(peaks[bucket], peak);
      });
      beats.push(...analysis.beats.map((beat) => beat + start));
    }
    return { peaks, beats };
  });
  queue = operation.then(
    () => undefined,
    () => undefined,
  );
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(asset.id, operation);
  void operation.catch(() => cache.delete(asset.id));
  return operation;
}
