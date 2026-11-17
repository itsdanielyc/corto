interface ModelFile {
  blob: Blob;
  headers: [string, string][];
  status: number;
}
const DATABASE = "corto-model-files-v1";
const STORE = "files";
let database: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
/** Blob-backed IndexedDB works in both browser and isolated Electron file-origin workers. */
export const modelCache = {
  async match(key: string): Promise<Response | undefined> {
    const database = await open();
    const value = await new Promise<ModelFile | undefined>(
      (resolve, reject) => {
        const request = database.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    return value
      ? new Response(value.blob, {
          status: value.status,
          headers: value.headers,
        })
      : undefined;
  },
  async put(key: string, response: Response): Promise<void> {
    const blob = await response.blob();
    if (blob.size > 512 * 1024 ** 2)
      throw new Error("The model file exceeds the download budget");
    const database = await open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(
        {
          blob,
          headers: [...response.headers],
          status: response.status,
        } satisfies ModelFile,
        key,
      );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
};
export async function clearModelFiles(): Promise<void> {
  const database = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
