import type { AudioClip, Project } from "../../contracts/project";
import {
  audioGain,
  audioSourceTime,
  duckingWindows,
  projectAudioClips,
} from "../domain/audio";
import { disposeMedia, waitForMedia } from "../media/import";

interface SoundPlayback {
  clip: AudioClip;
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  starting: boolean;
  shouldPlay: boolean;
}
const AUDIO_DRIFT_SECONDS = 0.2;

/** Share sound scheduling between live preview and local browser recording. */
export class AudioTimelinePlayer {
  private readonly sounds: SoundPlayback[] = [];
  private readonly clips: AudioClip[];
  private readonly windows;
  private disposed = false;
  ready = false;

  constructor(
    private readonly project: Project,
    private readonly resolveUrl: (id: string) => Promise<string>,
    private readonly report: (error: unknown) => void,
    private readonly output?: AudioNode,
  ) {
    this.clips = projectAudioClips(project);
    this.windows = project.duckMusic ? duckingWindows(project) : [];
  }

  async prepare(): Promise<void> {
    for (const clip of this.clips) {
      const url = await this.resolveUrl(clip.assetId);
      if (this.disposed) return;
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = clip.start < 1 ? "auto" : "metadata";
      audio.src = url;
      const sound: SoundPlayback = {
        clip,
        audio,
        source: null,
        starting: false,
        shouldPlay: false,
      };
      this.sounds.push(sound);
      await waitForMedia(audio, clip.start < 1);
      if (this.disposed) return;
      if (this.output) {
        sound.source = (
          this.output.context as AudioContext
        ).createMediaElementSource(audio);
        sound.source.connect(this.output);
      }
    }
    if (!this.disposed) this.ready = true;
  }

  /** Synchronize to the film clock, seeking only at starts, loops and meaningful drift. */
  sync(time: number, playing: boolean): void {
    if (!this.ready || this.disposed) return;
    const duck = this.windows.some(
      (window) => time >= window.start && time < window.end,
    );
    for (const sound of this.sounds) {
      const { clip, audio } = sound;
      const active =
        playing && time >= clip.start && time < clip.start + clip.duration;
      sound.shouldPlay = active;
      audio.volume = audioGain(clip, time, duck);
      if (!active) {
        audio.pause();
        continue;
      }
      const target = audioSourceTime(
        clip,
        time,
        this.project.assets[clip.assetId].duration,
      );
      if (
        Math.abs(audio.currentTime - target) > AUDIO_DRIFT_SECONDS ||
        audio.ended
      )
        audio.currentTime = target;
      if (audio.paused && !sound.starting) {
        sound.starting = true;
        audio.currentTime = target;
        void audio
          .play()
          .then(() => {
            if (this.disposed || !sound.shouldPlay) audio.pause();
          })
          .catch((error) => {
            if (!this.disposed && sound.shouldPlay) this.report(error);
          })
          .finally(() => {
            sound.starting = false;
          });
      }
    }
  }

  pause(): void {
    for (const sound of this.sounds) {
      sound.shouldPlay = false;
      sound.audio.pause();
    }
  }
  dispose(): void {
    this.disposed = true;
    for (const sound of this.sounds) {
      disposeMedia(sound.audio);
      sound.source?.disconnect();
    }
    this.sounds.length = 0;
  }
}
