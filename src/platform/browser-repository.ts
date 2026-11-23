import { encodeBundleHeader, readBundleIndex } from "../../contracts/bundle";
import type { ProjectRepository, SavedProject } from "../../contracts/platform";
import {
  mediaAssetSchema,
  identifierSchema,
  parseProject,
  type MediaAsset,
  type Project,
} from "../../contracts/project";
import { rekeyProjectAssets } from "../domain/rekey";
import {
  parseSavedRecord,
  recoverRecord,
  saveRecord,
  summarizeProject,
  unavailableSummary,
  UNREADABLE_WORKING_COPY_MESSAGE,
} from "../domain/catalogue";
import type { ProjectAction, ProjectVersion } from "../../contracts/services";
import { preferencesSchema } from "../../contracts/creative";
import type { Preferences } from "../../contracts/project";

const DATABASE_NAME = "corto-local-v1";
const PROJECT_STORE = "projects";
const MEDIA_STORE = "originals";
const CURRENT_PROJECT = "current";
const UNREADABLE_WORKING_COPY = Symbol("unreadable working copy");
const VERSION_STORE = "versions";
const PREFERENCES_STORE = "preferences";

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Local browser storage is unavailable"),
      );
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Read inside the write transaction so another tab's newer schema stays intact. */
async function currentForUpdate(
  store: IDBObjectStore,
): Promise<Project | undefined | typeof UNREADABLE_WORKING_COPY> {
  const value: unknown = await requestValue(store.get(CURRENT_PROJECT));
  if (value === undefined) return undefined;
  try {
    return parseProject(value);
  } catch {
    return UNREADABLE_WORKING_COPY;
  }
}

async function activateProject(
  store: IDBObjectStore,
  project: Project,
): Promise<void> {
  if ((await currentForUpdate(store)) !== UNREADABLE_WORKING_COPY)
    store.put(project, CURRENT_PROJECT);
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
export function projectFileName(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 80) || "Corto film"
  );
}

/** Real account-free browser storage. Blobs stay separate from small project manifests. */
export class BrowserProjectRepository implements ProjectRepository {
  private readonly database: Promise<IDBDatabase>;
  private readonly urls = new Map<string, string>();
  private pendingSave: Promise<void> = Promise.resolve();
  private readonly deletedIds = new Set<string>();

  constructor(databaseName = DATABASE_NAME) {
    this.database = new Promise((resolve, reject) => {
      const opening = indexedDB.open(databaseName, 2);
      opening.onupgradeneeded = () => {
        for (const store of [
          PROJECT_STORE,
          MEDIA_STORE,
          VERSION_STORE,
          PREFERENCES_STORE,
        ])
          if (!opening.result.objectStoreNames.contains(store))
            opening.result.createObjectStore(store);
      };
      opening.onsuccess = () => {
        opening.result.onversionchange = () => opening.result.close();
        resolve(opening.result);
      };
      opening.onerror = () => reject(opening.error);
      opening.onblocked = () =>
        reject(
          new Error("Close another Corto tab to finish opening local storage"),
        );
    });
  }

  async loadProject(): Promise<Project | null> {
    await this.pendingSave.catch(() => undefined);
    const database = await this.database;
    const result: unknown = await requestValue(
      database
        .transaction(PROJECT_STORE, "readonly")
        .objectStore(PROJECT_STORE)
        .get(CURRENT_PROJECT),
    );
    if (result === undefined) return null;
    try {
      return parseProject(result);
    } catch {
      throw new Error(UNREADABLE_WORKING_COPY_MESSAGE);
    }
  }

  async saveProject(input: Project, activate = true): Promise<void> {
    const project = parseProject(input);
    if (this.deletedIds.has(project.id))
      throw new Error("This film was removed from My films");
    const save = this.pendingSave
      .catch(() => undefined)
      .then(async () => {
        const database = await this.database;
        const transaction = database.transaction(
          [PROJECT_STORE, VERSION_STORE],
          "readwrite",
        );
        const finished = complete(transaction);
        const store = transaction.objectStore(PROJECT_STORE);
        const stored: unknown = await requestValue(store.get(project.id));
        const previous =
          stored === undefined ? undefined : parseSavedRecord(stored);
        if (
          previous &&
          JSON.stringify(previous.project) !== JSON.stringify(project)
        ) {
          const versions = transaction.objectStore(VERSION_STORE);
          const history =
            (await requestValue<
              { id: string; savedAt: string; project: Project }[] | undefined
            >(versions.get(project.id))) ?? [];
          versions.put(
            [
              {
                id: crypto.randomUUID(),
                savedAt: previous.updatedAt,
                project: previous.project,
              },
              ...history,
            ].slice(0, 30),
            project.id,
          );
        }
        store.put(saveRecord(project, previous), project.id);
        if (activate) await activateProject(store, project);
        await finished;
      });
    this.pendingSave = save;
    return save;
  }

  async projectAction(request: ProjectAction): Promise<Project | null> {
    const id = identifierSchema.parse(request.id);
    const project = await this.openProject(id);
    if (request.operation === "delete") {
      this.deletedIds.add(id);
      await this.pendingSave.catch(() => undefined);
      const database = await this.database;
      const transaction = database.transaction(
        [PROJECT_STORE, PREFERENCES_STORE],
        "readwrite",
      );
      const finished = complete(transaction);
      const store = transaction.objectStore(PROJECT_STORE);
      transaction.objectStore(PREFERENCES_STORE).put(project, `trash:${id}`);
      store.delete(id);
      const current = await currentForUpdate(store);
      if (current !== UNREADABLE_WORKING_COPY && current?.id === id)
        store.delete(CURRENT_PROJECT);
      await finished;
      return null;
    }
    const next = parseProject({
      ...project,
      id: request.operation === "duplicate" ? crypto.randomUUID() : id,
      name:
        request.operation === "rename"
          ? request.name
          : `${project.name.slice(0, 72)} (copy)`,
    });
    await this.saveProject(next, false);
    return next;
  }
  private async versionRecords(
    id: string,
  ): Promise<{ id: string; savedAt: string; project: Project }[]> {
    const database = await this.database;
    return (
      (await requestValue(
        database
          .transaction(VERSION_STORE)
          .objectStore(VERSION_STORE)
          .get(identifierSchema.parse(id)),
      )) ?? []
    );
  }
  async listVersions(id: string): Promise<ProjectVersion[]> {
    await this.pendingSave.catch(() => undefined);
    return (await this.versionRecords(id)).map((version) => ({
      id: version.id,
      savedAt: version.savedAt,
      name: version.project.name,
      sceneCount: version.project.scenes.length,
    }));
  }
  async restoreVersion(id: string, versionId: string): Promise<Project> {
    const version = (await this.versionRecords(id)).find(
      (version) => version.id === identifierSchema.parse(versionId),
    );
    if (!version) throw new Error("This version is unavailable");
    const project = parseProject({
      ...version.project,
      id: crypto.randomUUID(),
      name: `${version.project.name.slice(0, 65)} (version)`,
    });
    await this.saveProject(project);
    return project;
  }
  async loadPreferences(): Promise<Preferences> {
    const database = await this.database;
    return preferencesSchema.parse(
      (await requestValue(
        database
          .transaction(PREFERENCES_STORE)
          .objectStore(PREFERENCES_STORE)
          .get("settings"),
      )) ?? {},
    );
  }
  async savePreferences(input: Preferences): Promise<void> {
    const preferences = preferencesSchema.parse(input);
    const database = await this.database;
    const transaction = database.transaction(PREFERENCES_STORE, "readwrite");
    const finished = complete(transaction);
    transaction.objectStore(PREFERENCES_STORE).put(preferences, "settings");
    await finished;
  }

  async listProjects() {
    await this.pendingSave.catch(() => undefined);
    const database = await this.database;
    const store = database
      .transaction(PROJECT_STORE)
      .objectStore(PROJECT_STORE);
    const [keys, values] = await Promise.all([
      requestValue(store.getAllKeys()),
      requestValue(store.getAll()),
    ]);
    return values
      .flatMap((value: unknown, index) => {
        const key = keys[index];
        if (key === CURRENT_PROJECT || typeof key !== "string") return [];
        try {
          const record = parseSavedRecord(value);
          if (record.project.id !== key)
            throw new Error("Saved film identifiers do not match");
          return [summarizeProject(record)];
        } catch {
          let recovery: Project | undefined;
          try {
            if (value && typeof value === "object" && "previous" in value)
              recovery = parseProject(value.previous);
          } catch {
            /* Keep the unreadable entry visible without inventing recovery. */
          }
          return [unavailableSummary(key, recovery)];
        }
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async openProject(id: string, recover = false): Promise<Project> {
    await this.pendingSave.catch(() => undefined);
    const database = await this.database;
    const record: SavedProject | undefined = await requestValue(
      database
        .transaction(PROJECT_STORE)
        .objectStore(PROJECT_STORE)
        .get(identifierSchema.parse(id)),
    );
    if (!record) throw new Error("This saved film could not be found");
    return recover ? recoverRecord(record) : parseSavedRecord(record).project;
  }

  async putAsset(input: MediaAsset, file: Blob): Promise<void> {
    const asset = mediaAssetSchema.parse(input);
    if (file.size !== asset.size)
      throw new Error(`The original media changed: ${asset.name}`);
    const database = await this.database;
    const transaction = database.transaction(MEDIA_STORE, "readwrite");
    const finished = complete(transaction);
    transaction.objectStore(MEDIA_STORE).add(file, asset.id);
    await finished;
  }

  async assetBlob(id: string): Promise<Blob> {
    const database = await this.database;
    const value: unknown = await requestValue(
      database
        .transaction(MEDIA_STORE, "readonly")
        .objectStore(MEDIA_STORE)
        .get(id),
    );
    if (!(value instanceof Blob))
      throw new Error(
        "Original media is missing. Open a portable .corto copy to restore it.",
      );
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
      if (blob.size !== project.assets[id].size)
        throw new Error("An original media file is incomplete");
      originals.push(blob);
    }
    downloadBlob(
      new Blob([encodeBundleHeader(project), ...originals], {
        type: "application/x-corto",
      }),
      `${projectFileName(project.name)}.corto`,
    );
    return true;
  }

  /** Import manifests and Blob slices in one transaction; quota errors roll back the entire change. */
  async openPortable(file?: File): Promise<Project | null> {
    if (!file) return null;
    await this.pendingSave.catch(() => undefined);
    const index = await readBundleIndex({
      size: file.size,
      read: async (start, end) =>
        new Uint8Array(await file.slice(start, end).arrayBuffer()),
    });
    const remapped = rekeyProjectAssets(index.project);
    const database = await this.database;
    const transaction = database.transaction(
      [PROJECT_STORE, MEDIA_STORE],
      "readwrite",
    );
    const finished = complete(transaction);
    const originals = transaction.objectStore(MEDIA_STORE);
    for (const { asset, offset } of index.assets)
      originals.add(
        file.slice(offset, offset + asset.size, asset.mime),
        remapped.identifiers.get(asset.id)!,
      );
    await activateProject(
      transaction.objectStore(PROJECT_STORE),
      remapped.project,
    );
    transaction
      .objectStore(PROJECT_STORE)
      .put(saveRecord(remapped.project), remapped.project.id);
    await finished;
    return remapped.project;
  }

  releaseMediaUrls(): void {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}
