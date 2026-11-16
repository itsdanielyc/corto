import {
  LIMITS,
  audioClipSchema,
  type AudioClip,
  type MediaAsset,
  type Project,
} from "../../contracts/project";
import { filmDuration } from "./timeline";

export const MUSIC_DUCK_GAIN = 0.25;
const LEGACY_MUSIC_FADE_SECONDS = 0.3;
export interface SoundWindow {
  start: number;
  end: number;
}

/** Translate the original one-song control into the same timeline as placed sound. */
export function projectAudioClips(project: Project): AudioClip[] {
  const duration = filmDuration(project.scenes);
  const legacyDuration =
    project.music && !project.music.loop
      ? Math.min(duration, project.assets[project.music.assetId].duration)
      : duration;
  const legacy =
    project.music && duration > 0
      ? [
          {
            id: "legacy-music",
            assetId: project.music.assetId,
            role: "music" as const,
            start: 0,
            offset: 0,
            duration: project.music.loop
              ? duration
              : Math.min(
                  duration,
                  project.assets[project.music.assetId].duration,
                ),
            volume: project.music.volume,
            loop: project.music.loop,
            fadeIn: Math.min(LEGACY_MUSIC_FADE_SECONDS, legacyDuration / 2),
            fadeOut: Math.min(LEGACY_MUSIC_FADE_SECONDS, legacyDuration / 2),
          },
        ]
      : [];
  return [...legacy, ...project.audioClips];
}

/** Append one song after the previously placed music. */
export function placeNextSong(project: Project, asset: MediaAsset): Project {
  let clips = projectAudioClips(project);
  if (project.music) {
    const original = project.assets[project.music.assetId];
    const first = createAudioClip(original, "music");
    // Adding a next song intentionally ends the old all-film loop after one complete play.
    clips = [
      {
        ...first,
        volume: project.music.volume,
        fadeIn: Math.min(LEGACY_MUSIC_FADE_SECONDS, first.duration / 2),
        fadeOut: Math.min(LEGACY_MUSIC_FADE_SECONDS, first.duration / 2),
      },
      ...project.audioClips,
    ];
  }
  const start = clips
    .filter((clip) => clip.role === "music")
    .reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
  if (clips.length >= LIMITS.audioClips)
    throw new Error("This film has too many placed sounds");
  return {
    ...project,
    music: null,
    audioClips: [...clips, createAudioClip(asset, "music", start)],
  };
}

/** Create a source-bounded song or narration without altering its recording. */
export function createAudioClip(
  asset: MediaAsset,
  role: AudioClip["role"],
  start = 0,
): AudioClip {
  if (asset.kind !== "audio" || start >= LIMITS.filmSeconds)
    throw new Error("Choose audio and a start within the film limit");
  return audioClipSchema.parse({
    id: crypto.randomUUID(),
    assetId: asset.id,
    role,
    start,
    offset: 0,
    duration: Math.min(asset.duration, LIMITS.filmSeconds - start),
    volume: role === "music" ? 0.5 : 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
  });
}

// Time O((scenes + sounds) log(sc​​enes + sounds)), space O(scenes + sounds).
/** Merge audible clip/narration intervals so music is reduced once even during overlaps. */
export function duckingWindows(project: Project): SoundWindow[] {
  const windows: SoundWindow[] = [];
  let start = 0;
  for (const scene of project.scenes) {
    if (
      scene.assetId &&
      project.assets[scene.assetId].kind === "video" &&
      scene.volume > 0
    )
      windows.push({ start, end: start + scene.duration });
    start += scene.duration;
  }
  for (const clip of project.audioClips)
    if (clip.role === "voiceover" && clip.volume > 0)
      windows.push({ start: clip.start, end: clip.start + clip.duration });
  windows.sort((a, b) => a.start - b.start);
  const merged: SoundWindow[] = [];
  for (const window of windows) {
    const previous = merged.at(-1);
    if (previous && window.start <= previous.end)
      previous.end = Math.max(previous.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}

/** Gain is shared by preview and browser export; native builds the same bounded envelope. */
export function audioGain(clip: AudioClip, time: number, duck = false): number {
  const local = time - clip.start;
  if (local < 0 || local >= clip.duration) return 0;
  const fadeIn = clip.fadeIn > 0 ? Math.min(1, local / clip.fadeIn) : 1;
  const fadeOut =
    clip.fadeOut > 0 ? Math.min(1, (clip.duration - local) / clip.fadeOut) : 1;
  return (
    clip.volume *
    fadeIn *
    fadeOut *
    (duck && clip.role === "music" ? MUSIC_DUCK_GAIN : 1)
  );
}

/** Loop the remaining source region, respecting a trimmed start. */
export function audioSourceTime(
  clip: AudioClip,
  time: number,
  sourceDuration: number,
): number {
  const local = Math.max(0, time - clip.start);
  const available = sourceDuration - clip.offset;
  return clip.offset + (clip.loop && available > 0 ? local % available : local);
}
