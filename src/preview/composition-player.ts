import type { Project, Scene, VisualLayer } from "../../contracts/project";
import {
  buildTimeline,
  fadeOpacity,
  locateComposition,
} from "../domain/timeline";
import { MediaPool } from "./media-pool";
import { sceneMediaKey } from "./composite";
import { seekVideo } from "./seek";
import type { VisualMedia } from "../media/import";
import { prepareLook } from "./effects";

interface MediaReference {
  id: string;
  key: string;
  layer?: VisualLayer;
  background?: boolean;
}
interface GainConnection {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
}
function mediaReferences(scene: Scene): MediaReference[] {
  const references: MediaReference[] = [];
  if (scene.assetId)
    references.push({
      id: scene.assetId,
      key: sceneMediaKey(scene, scene.assetId),
    });
  if (scene.backdrop.assetId)
    references.push({
      id: scene.backdrop.assetId,
      key: sceneMediaKey(scene, scene.backdrop.assetId, "backdrop"),
      background: true,
    });
  for (const layer of scene.layers)
    if (layer.assetId)
      references.push({
        id: layer.assetId,
        key: sceneMediaKey(scene, layer.assetId, layer.id),
        layer,
      });
  return references;
}

/** A decoder window is bounded to active/next scenes and their limited layers; reused clips get independent clocks. */
export class CompositionPlayer {
  private readonly pool = new MediaPool();
  private readonly timeline;
  private readonly gains = new Map<HTMLVideoElement, GainConnection>();
  private audio: AudioContext | null = null;
  constructor(
    private readonly project: Project,
    private readonly url: (id: string) => Promise<string>,
    private readonly output?: AudioNode,
    private readonly useProxy = false,
  ) {
    this.timeline = buildTimeline(project.scenes);
  }
  private asset(id: string) {
    const original = this.project.assets[id];
    return this.useProxy && original.proxyAssetId
      ? (this.project.assets[original.proxyAssetId] ?? original)
      : original;
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
      for (const reference of mediaReferences(next)) {
        kept.add(reference.key);
        const asset = this.asset(reference.id);
        void this.url(asset.id)
          .then((url) => this.pool.get(asset, url, reference.key))
          .catch(() => undefined);
      }
    for (const entry of active) {
      if (entry.scene.adjustments.lutAssetId)
        await prepareLook(
          entry.scene.adjustments.lutAssetId,
          await this.url(entry.scene.adjustments.lutAssetId),
        );
      for (const reference of mediaReferences(entry.scene)) {
        signal.throwIfAborted();
        kept.add(reference.key);
        const asset = this.asset(reference.id);
        const media = await this.pool.get(
          asset,
          await this.url(asset.id),
          reference.key,
        );
        signal.throwIfAborted();
        if (media instanceof HTMLVideoElement) {
          const layer = reference.layer;
          const sourceTime = reference.background
            ? 0
            : layer
              ? layer.sourceStart + Math.max(0, entry.localTime - layer.start)
              : entry.scene.start + entry.localTime * entry.scene.speed;
          const loop = layer?.loop ?? entry.scene.loop;
          const target = loop
            ? sourceTime % Math.max(0.001, asset.duration)
            : Math.min(Math.max(0, asset.duration - 0.001), sourceTime);
          if (Math.abs(media.currentTime - target) > 0.12 || media.paused)
            await seekVideo(media, target, signal);
          media.playbackRate = layer ? 1 : entry.scene.speed;
          media.preservesPitch = layer ? true : entry.scene.preservePitch;
        }
        result.set(reference.key, media);
      }
    }
    this.pool.retain(kept);
    const retained = new Set([...kept].map((key) => this.pool.ready(key)));
    const audible = new Set(result.values());
    for (const [element, connection] of this.gains) {
      if (!retained.has(element)) {
        connection.source.disconnect();
        connection.gain.disconnect();
        this.gains.delete(element);
      } else if (!audible.has(element)) {
        element.pause();
        connection.gain.gain.value = 0;
      }
    }
    return result;
  }

  /** Gain nodes support boosts; hidden/not-yet-started video overlays never play their source sound. */
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
      const reference = mediaReferences(entry.scene).find(
        (reference) => reference.key === key,
      );
      if (!reference) continue;
      const layer = reference.layer;
      const active =
        !reference.background &&
        (!layer ||
          (entry.localTime >= layer.start &&
            entry.localTime < (layer.end ?? entry.scene.duration)));
      if (!active) {
        element.pause();
        const existing = this.gains.get(element);
        if (existing) existing.gain.gain.value = 0;
        continue;
      }
      let gain =
        (layer ? layer.volume : entry.scene.volume) *
        fadeOpacity(entry.scene, entry.localTime);
      if (
        layer &&
        !layer.loop &&
        layer.sourceStart + entry.localTime - layer.start >=
          this.project.assets[reference.id].duration
      )
        gain = 0;
      if (!layer) {
        if (entry.scene.audioFadeIn)
          gain *= Math.min(1, entry.localTime / entry.scene.audioFadeIn);
        if (entry.scene.audioFadeOut)
          gain *= Math.min(
            1,
            (entry.scene.duration - entry.localTime) / entry.scene.audioFadeOut,
          );
      }
      if (located?.to)
        gain *=
          entry === located.from ? 1 - located.progress : located.progress;
      let connection = this.gains.get(element);
      if (!connection) {
        this.audio ??=
          (this.output?.context as AudioContext) ?? new AudioContext();
        const source = this.audio.createMediaElementSource(element);
        const node = this.audio.createGain();
        source.connect(node);
        node.connect(this.output ?? this.audio.destination);
        connection = { source, gain: node };
        this.gains.set(element, connection);
      }
      connection.gain.gain.value = Math.max(0, gain);
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
    for (const connection of this.gains.values()) {
      connection.source.disconnect();
      connection.gain.disconnect();
    }
    this.gains.clear();
    if (!this.output) void this.audio?.close();
  }
}
