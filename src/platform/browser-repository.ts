import { encodeBundleHeader, readBundleIndex } from "../../contracts/bundle";
import type { ProjectRepository } from "../../contracts/platform";
import { mediaAssetSchema, parseProject, type MediaAsset, type Project } from "../../contracts/project";
import { rekeyProjectAssets } from "../domain/rekey";

const DATABASE_NAME = "corto-local-v1";
const PROJECT_STORE = "projects";
const MEDIA_STORE = "originals";
const CURRENT_PROJECT = "current";

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Local browser storage is unavailable"));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

/** Download locally, keeping the object URL alive until the browser has consumed it. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Remove filename separators while retaining meaningful international project names. */
export function projectFileName(name: string): string { return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().slice(0, 80) || "Corto film"; }

/** Real account-free browser storage. Blobs stay separate from small project manifests. */
export class BrowserProjectRepository implements ProjectRepository {
  private readonly database: Promise<IDBDatabase>;
  private readonly urls = new Map<string, string>();
  private pendingSave: Promise<void> = Promise.resolve();

  constructor(databaseName = DATABASE_NAME) {
    this.database = new Promise((resolve, reject) => {
      const opening = indexedDB.open(databaseName, 1);
      opening.onupgradeneeded = () => {
        opening.result.createObjectStore(PROJECT_STORE);
        opening.result.createObjectStore(MEDIA_STORE);
      };
      opening.onsuccess = () => {
        opening.result.onversionchange = () => opening.result.close();
        resolve(opening.result);
      };
      opening.onerror = () => reject(opening.error);
      opening.onblocked = () => reject(new Error("Close another Corto tab to finish opening local storage"));
    });
  }

  async loadProject(): Promise<Project | null> {
    await this.pendingSave.catch(() => undefined);
    const database = await this.database;
    const result: unknown = await requestValue(database.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).get(CURRENT_PROJECT));
    return result === undefined ? null : parseProject(result);
  }

  async saveProject(input: Project): Promise<void> {
    const project = parseProject(input);
    const save = this.pendingSave.catch(() => undefined).then(async () => {
      const database = await this.database;
      const transaction = database.transaction(PROJECT_STORE, "readwrite");
      const finished = complete(transaction);
      transaction.objectStore(PROJECT_STORE).put(project, CURRENT_PROJECT);
      await finished;
    });
    this.pendingSave = save;
    return save;
  }

  async putAsset(input: MediaAsset, file: Blob): Promise<void> {
    const asset = mediaAssetSchema.parse(input);
    if (file.size !== asset.size) throw new Error(`The original media changed: ${asset.name}`);
    const database = await this.database;
    const transaction = database.transaction(MEDIA_STORE, "readwrite");
    const finished = complete(transaction);
    transaction.objectStore(MEDIA_STORE).add(file, asset.id);
    await finished;
  }

  async assetBlob(id: string): Promise<Blob> {
    const database = await this.database;
    const value: unknown = await requestValue(database.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).get(id));
    if (!(value instanceof Blob)) throw new Error("Original media is missing. Open a portable .corto copy to restore it.");
    return value;
  }

  async assetUrl(id: string): Promise<string> {
    const existing = this.urls.get(id);
    if (existing) return existing;
    const blob = await this.assetBlob(id);
    const raced = this.urls.get(id);
    if (raced) return raced;
    const url = URL.createObjectURL(blob);
    this.urls.set(id, url);
    return url;
  }

  async savePortable(input: Project): Promise<boolean> {
    const project = parseProject(input);
    const originals: Blob[] = [];
    for (const id of Object.keys(project.assets).sort()) {
      const blob = await this.assetBlob(id);
      if (blob.size !== project.assets[id].size) throw new Error("An original media file is incomplete");
      originals.push(blob);
    }
    downloadBlob(new Blob([encodeBundleHeader(project), ...originals], { type: "application/x-corto" }), `${projectFileName(project.name)}.corto`);
    return true;
  }

  /** Import manifests and Blob slices in one transaction; quota errors roll back the entire change. */
  async openPortable(file: File): Promise<Project> {
    await this.pendingSave.catch(() => undefined);
    const index = await readBundleIndex({ size: file.size, read: async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer()) });
    const remapped = rekeyProjectAssets(index.project);
    const database = await this.database;
    const transaction = database.transaction([PROJECT_STORE, MEDIA_STORE], "readwrite");
    const finished = complete(transaction);
    const originals = transaction.objectStore(MEDIA_STORE);
    for (const { asset, offset } of index.assets) originals.add(file.slice(offset, offset + asset.size, asset.mime), remapped.identifiers.get(asset.id)!);
    transaction.objectStore(PROJECT_STORE).put(remapped.project, CURRENT_PROJECT);
    await finished;
    return remapped.project;
  }

  releaseMediaUrls(): void {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}
