import type { Project, Scene } from "../../contracts/project";
import { buildTimeline, locateComposition } from "../domain/timeline";
import { MediaPool } from "./media-pool";
import { sceneMediaKey } from "./composite";
import { seekVideo } from "./seek";
import type { VisualMedia } from "../media/import";
import { prepareLook } from "./effects";
import { fadeOpacity } from "../domain/timeline";

/** Required visual references for one scene, bounded by the layer contract. */
export function sceneAssetIds(scene: Scene): string[] {
  return [
    ...new Set(
      [
        scene.assetId,
        scene.backdrop.assetId,
        ...scene.layers.map((layer) => layer.assetId),
      ].filter((id): id is string => !!id),
    ),
  ];
}

/** Own a small decoder window, including independent instances when adjacent scenes reuse a video. */
export class CompositionPlayer {
  private readonly pool = new MediaPool();
  private readonly timeline;
  private readonly gains = new Map<HTMLVideoElement, GainNode>();
  private audio: AudioContext | null = null;
  constructor(
    private readonly project: Project,
    private readonly url: (id: string) => Promise<string>,
    private readonly output?: AudioNode,
    private readonly useProxy = false,
  ) {
    this.timeline = buildTimeline(project.scenes);
  }

  async prepare(
    time: number,
    signal: AbortSignal,
  ): Promise<Map<string, VisualMedia>> {
    const located = locateComposition(this.timeline, time);
    const result = new Map<string, VisualMedia>();
    if (!located) return result;
    const active = [located.from, located.to].filter(
      (entry): entry is NonNullable<typeof entry> => !!entry,
    );
    const kept = new Set<string>();
    const next = this.timeline[(located.to ?? located.from).index + 1]?.scene;
    if (next)
      for (const id of sceneAssetIds(next)) {
        const key = sceneMediaKey(next, id);
        kept.add(key);
        const original = this.project.assets[id];
        const asset =
          this.useProxy && original.proxyAssetId
            ? (this.project.assets[original.proxyAssetId] ?? original)
            : original;
        void this.url(asset.id)
          .then((url) => this.pool.get(asset, url, key))
          .catch(() => undefined);
      }
    for (const entry of active) {
      if (entry.scene.adjustments.lutAssetId)
        await prepareLook(
          entry.scene.adjustments.lutAssetId,
          await this.url(entry.scene.adjustments.lutAssetId),
        );
      for (const id of sceneAssetIds(entry.scene)) {
        signal.throwIfAborted();
        const key = sceneMediaKey(entry.scene, id);
        kept.add(key);
        const sourceAsset = this.project.assets[id];
        const asset =
          this.useProxy && sourceAsset.proxyAssetId
            ? (this.project.assets[sourceAsset.proxyAssetId] ?? sourceAsset)
            : sourceAsset;
        const media = await this.pool.get(asset, await this.url(asset.id), key);
        signal.throwIfAborted();
        if (media instanceof HTMLVideoElement) {
          const layer = entry.scene.layers.find(
            (candidate) => candidate.assetId === id,
          );
          const sourceTime = layer
            ? layer.sourceStart + Math.max(0, entry.localTime - layer.start)
            : entry.scene.start + entry.localTime * entry.scene.speed;
          const loop = layer?.loop ?? entry.scene.loop;
          const target = loop
            ? sourceTime % Math.max(0.001, asset.duration)
            : Math.min(Math.max(0, asset.duration - 0.001), sourceTime);
          if (Math.abs(media.currentTime - target) > 0.12 || media.paused)
            await seekVideo(media, target, signal);
          media.playbackRate = layer ? 1 : entry.scene.speed;
          media.preservesPitch = entry.scene.preservePitch;
        }
        result.set(key, media);
      }
    }
    this.pool.retain(kept);
    for (const [element, node] of this.gains)
      if (![...result.values()].includes(element)) {
        element.pause();
        node.gain.value = 0;
      }
    return result;
  }

  /** Gain nodes support boosts above the HTML media element's 100% limit. */
  async play(
    media: ReadonlyMap<string, VisualMedia>,
    time: number,
  ): Promise<void> {
    const located = locateComposition(this.timeline, time);
    for (const [key, element] of media) {
      if (!(element instanceof HTMLVideoElement)) continue;
      const entry = [located?.from, located?.to].find(
        (candidate) => candidate && key.startsWith(`${candidate.scene.id}:`),
      );
      if (!entry) continue;
      const layer = entry.scene.layers.find(
        (candidate) =>
          candidate.assetId &&
          key === sceneMediaKey(entry.scene, candidate.assetId),
      );
      let gain = layer ? layer.volume : entry.scene.volume;
      if (!layer) {
        gain *= fadeOpacity(entry.scene, entry.localTime);
        const fadeIn = entry.scene.audioFadeIn;
        const fadeOut = entry.scene.audioFadeOut;
        if (fadeIn) gain *= Math.min(1, entry.localTime / fadeIn);
        if (fadeOut)
          gain *= Math.min(
            1,
            (entry.scene.duration - entry.localTime) / fadeOut,
          );
      }
      if (located?.to)
        gain *=
          entry === located.from ? 1 - located.progress : located.progress;
      let node = this.gains.get(element);
      if (!node) {
        this.audio ??=
          (this.output?.context as AudioContext) ?? new AudioContext();
        node = this.audio.createGain();
        this.audio.createMediaElementSource(element).connect(node);
        node.connect(this.output ?? this.audio.destination);
        this.gains.set(element, node);
      }
      node.gain.value = Math.max(0, gain);
      element.volume = 1;
      await this.audio?.resume();
      if (element.paused) await element.play();
    }
  }
  pause(): void {
    this.pool.pauseExcept(null);
  }
  dispose(): void {
    this.pool.dispose();
    for (const node of this.gains.values()) node.disconnect();
    this.gains.clear();
    if (!this.output) void this.audio?.close();
  }
}
