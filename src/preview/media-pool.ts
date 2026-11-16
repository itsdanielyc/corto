import type { MediaAsset } from "../../contracts/project";
import { disposeMedia, waitForMedia, type VisualMedia } from "../media/import";

interface Entry {
  element: VisualMedia;
  ready: boolean;
  promise: Promise<VisualMedia>;
}

/** Keep only the active and next scene decoded, avoiding a video element for every timeline item. */
export class MediaPool {
  private readonly entries = new Map<string, Entry>();

  get(asset: MediaAsset, url: string): Promise<VisualMedia> {
    const cached = this.entries.get(asset.id);
    if (cached) return cached.promise;
    const element =
      asset.kind === "image" ? new Image() : document.createElement("video");
    element.crossOrigin = "anonymous";
    if (element instanceof HTMLVideoElement) {
      element.preload = "auto";
      element.playsInline = true;
    }
    element.src = url;
    const entry: Entry = {
      element,
      ready: false,
      promise: Promise.resolve(element),
    };
    entry.promise = (
      element instanceof HTMLImageElement
        ? element.decode()
        : waitForMedia(element)
    ).then(() => {
      entry.ready = true;
      return element;
    });
    this.entries.set(asset.id, entry);
    return entry.promise;
  }

  ready(id: string): VisualMedia | null {
    const entry = this.entries.get(id);
    return entry?.ready ? entry.element : null;
  }

  pauseExcept(id: string | null): void {
    for (const [key, entry] of this.entries)
      if (key !== id && entry.element instanceof HTMLVideoElement)
        entry.element.pause();
  }

  retain(ids: ReadonlySet<string>): void {
    for (const [id, entry] of this.entries)
      if (!ids.has(id)) {
        disposeMedia(entry.element);
        this.entries.delete(id);
      }
  }

  dispose(): void {
    this.retain(new Set());
  }
}
