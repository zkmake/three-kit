/**
 * The settled setting, kept per device (localStorage), so the next visit starts where this one
 * ended instead of at the top. Stored as the setting, not the level, since the ladder can differ
 * between visits (another window size). Every access is wrapped: storage can be missing, full or
 * blocked (private windows, embedded frames), and the page must run the same without it.
 */
import type { Rung } from "./ladder.ts";

type StoredQuality = Rung & {
  /** A player's own choice (`pin`), rather than what the controller settled on. */
  readonly pinned: boolean;
};

type QualityStorage = Pick<Storage, "getItem" | "setItem">;

const DEFAULT_STORAGE_KEY = "three-quality";

const defaultStorage = (): QualityStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const isStored = (value: unknown): value is StoredQuality => {
  const stored = value as Partial<StoredQuality> | null;

  return (
    typeof stored === "object" &&
    stored !== null &&
    typeof stored.dpr === "number" &&
    stored.dpr > 0 &&
    typeof stored.tiersOff === "number" &&
    stored.tiersOff >= 0 &&
    typeof stored.pinned === "boolean"
  );
};

const loadQuality = (key: string, storage = defaultStorage()): StoredQuality | null => {
  try {
    const raw = storage?.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    return isStored(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const saveQuality = (key: string, quality: StoredQuality, storage = defaultStorage()) => {
  try {
    storage?.setItem(
      key,
      JSON.stringify({ dpr: quality.dpr, pinned: quality.pinned, tiersOff: quality.tiersOff }),
    );
  } catch {
    // Full or blocked: the next visit starts at the top, as a first one does.
  }
};

export { DEFAULT_STORAGE_KEY, loadQuality, saveQuality };
export type { QualityStorage, StoredQuality };
