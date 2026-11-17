import type { Project } from "../../contracts/project";
import { buildTimeline, filmDuration, locateScene } from "../domain/timeline";
import { projectAudioClips, audioSourceTime } from "../domain/audio";

export interface SpeechWindow {
  start: number;
  duration: number;
  assetId: string;
  sourceStart: number;
  speed: number;
  preservePitch: boolean;
}

// Time O(boundaries × voiceovers + boundaries log scenes), space O(boundaries). Voiceovers are capped at 128.
/** Partition audible speech sources, prioritising narration and bounding every inference/audio window to 30 seconds. */
export function speechWindows(project: Project): SpeechWindow[] {
  const timeline = buildTimeline(project.scenes);
  const total = filmDuration(project.scenes);
  const narration = projectAudioClips(project).filter(
    (clip) => clip.role === "voiceover" && clip.volume > 0,
  );
  const boundaries = [
    ...new Set([
      0,
      total,
      ...timeline.flatMap((entry) => [entry.start, entry.end]),
      ...narration.flatMap((clip) => [
        Math.min(total, clip.start),
        Math.min(total, clip.start + clip.duration),
      ]),
    ]),
  ].sort((a, b) => a - b);
  const result: SpeechWindow[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    let start = boundaries[index];
    const end = boundaries[index + 1];
    const voice = narration.find(
      (clip) => clip.start <= start && clip.start + clip.duration > start,
    );
    const entry = locateScene(timeline, start);
    const assetId =
      voice?.assetId ?? (entry?.scene.volume ? entry.scene.assetId : null);
    const asset = assetId ? project.assets[assetId] : null;
    if (
      !asset ||
      asset.hasAudio === false ||
      !["audio", "video"].includes(asset.kind)
    )
      continue;
    const speed = voice ? 1 : entry!.scene.speed;
    while (start < end - 0.001) {
      const sourceStart = voice
        ? audioSourceTime(voice, start, asset.duration)
        : entry!.scene.loop
          ? (entry!.scene.start + (start - entry!.start) * speed) %
            asset.duration
          : entry!.scene.start + (start - entry!.start) * speed;
      const duration = Math.min(
        30,
        end - start,
        (asset.duration - sourceStart) / speed,
      );
      if (duration <= 0.001) break;
      result.push({
        start,
        duration,
        assetId: asset.id,
        sourceStart,
        speed,
        preservePitch: voice ? true : entry!.scene.preservePitch,
      });
      start += duration;
    }
  }
  return result;
}
