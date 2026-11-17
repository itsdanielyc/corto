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

/** Resolve film-following sounds without adding a second editing or persistence model. */
export function projectAudioClips(project: Project): AudioClip[] {
  const duration = filmDuration(project.scenes);
  return project.audioClips.map((clip) => {
    if (!clip.followFilm) return clip;
    const available = clip.loop
      ? Infinity
      : project.assets[clip.assetId].duration - clip.offset;
    const length = Math.min(
      duration > clip.start ? duration - clip.start : clip.duration,
      available,
    );
    return {
      ...clip,
      duration: length,
      fadeIn: Math.min(clip.fadeIn, length / 2),
      fadeOut: Math.min(clip.fadeOut, length / 2),
    };
  });
}

/** Append one song after the previously placed music. */
export function placeNextSong(project: Project, asset: MediaAsset): Project {
  const clips = project.audioClips.map((clip) =>
    clip.followFilm
      ? {
          ...clip,
          followFilm: false,
          loop: false,
          duration: Math.min(
            project.assets[clip.assetId].duration - clip.offset,
            LIMITS.filmSeconds - clip.start,
          ),
        }
      : clip,
  );
  const start = clips
    .filter((clip) => clip.role === "music")
    .reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
  if (clips.length >= LIMITS.audioClips)
    throw new Error("This film has too many placed sounds");
  return {
    ...project,
    audioClips: [...clips, createAudioClip(asset, "music", start)],
  };
}

/** Keep the beginner's first song spanning the film, using the same placed-sound record as every other sound. */
export function addMusic(project: Project, asset: MediaAsset): Project {
  if (project.audioClips.length) return placeNextSong(project, asset);
  const clip = createAudioClip(asset, "music");
  const fade = Math.min(LEGACY_MUSIC_FADE_SECONDS, clip.duration / 2);
  return {
    ...project,
    audioClips: [
      { ...clip, loop: true, followFilm: true, fadeIn: fade, fadeOut: fade },
    ],
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
