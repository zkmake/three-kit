/**
 * Where swaps survive a reload. IndexedDB by default: painted textures are megabytes each, past
 * what `localStorage` holds, and a live-linked file's handle can be kept too (handles clone into
 * IndexedDB; they can't be stringified).
 */

export type StoredSwap = {
  blob: Blob;
  fileName: string | null;
  showingOriginal: boolean;
  /** A live-linked file, to resume after a reload (the browser asks for permission again). */
  handle?: FileSystemFileHandleLike | undefined;
};

/** The slice of the File System Access API's file handle the live link uses. */
export type FileSystemFileHandleLike = {
  name: string;
  getFile(): Promise<File>;
  queryPermission?(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "read" }): Promise<PermissionState>;
};

export type SwapStore = {
  get(id: string): Promise<StoredSwap | undefined>;
  set(id: string, swap: StoredSwap): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
};

/** A store that lives as long as the page: tests, or `storageKey: null`. */
export const memoryStore = (): SwapStore => {
  const swaps = new Map<string, StoredSwap>();

  return {
    get: async (id) => swaps.get(id),
    set: async (id, swap) => {
      swaps.set(id, swap);
    },
    delete: async (id) => {
      swaps.delete(id);
    },
    clear: async () => {
      swaps.clear();
    },
  };
};

const DATABASE = "zkmake-three-textures";
/** Sorts after every character a key can hold: the top of a key-prefix range. */
const LAST_CHAR = String.fromCharCode(0xffff);
const STORE = "swaps";

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Swaps in IndexedDB, keyed `<storageKey>/<texture name>`. Falls back to memory without it. */
export const indexedDbStore = (storageKey: string): SwapStore => {
  if (typeof indexedDB === "undefined") {
    return memoryStore();
  }

  let opened: Promise<IDBDatabase> | null = null;
  const database = () => {
    opened ??= new Promise((resolve, reject) => {
      const open = indexedDB.open(DATABASE, 1);

      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });

    return opened;
  };
  const key = (id: string) => `${storageKey}/${id}`;
  const store = async (mode: IDBTransactionMode) =>
    (await database()).transaction(STORE, mode).objectStore(STORE);

  return {
    get: async (id) =>
      (await request((await store("readonly")).get(key(id)))) as StoredSwap | undefined,
    set: async (id, swap) => {
      await request((await store("readwrite")).put(swap, key(id)));
    },
    delete: async (id) => {
      await request((await store("readwrite")).delete(key(id)));
    },
    clear: async () => {
      const range = IDBKeyRange.bound(`${storageKey}/`, `${storageKey}/${LAST_CHAR}`);

      await request((await store("readwrite")).delete(range));
    },
  };
};
