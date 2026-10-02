/**
 * `TextureLab`: the textures a scene draws with, and swaps on them. No UI; the panel drives it.
 *
 * Each entry is one image's worth of pixels (one `Source`): every texture sharing it swaps
 * together. Entries are named by the `textures` option, else the texture's name, else its file,
 * else the material slot it fills; the name is also the key a swap is saved under, so a swap comes
 * back on reload for as long as the name holds.
 */
import type { Object3D, Texture, WebGLRenderer } from "three";

import { findTextures, type Found, type TextureSource } from "./discover.ts";
import { formatOf, kindOf, sizeOf, type TextureKind } from "./kinds.ts";
import { fileNameOf, sourceUrlOf, stem } from "./names.ts";
import { canReadBack, readTexture, readTextureAsync, readTextureBlob } from "./readback.ts";
import {
  type FileSystemFileHandleLike,
  indexedDbStore,
  memoryStore,
  type SwapStore,
} from "./store.ts";
import {
  type Applied,
  applyImage,
  bindNewRefs,
  boundTextures,
  canSwap,
  revertImage,
  showOriginal,
  type SwapImage,
} from "./swap.ts";

export type TextureInfo = {
  name: string;
  texture: Texture;
  /** The file it was loaded from, for downloads and thumbnails. */
  src?: string;
};

export type SwapEvent = {
  id: string;
  /** Every texture sharing the swapped pixels (the originals). */
  textures: Texture[];
  /** The textures drawing now: the originals after an in-place swap or a revert, else twins. */
  bound: Texture[];
  state: EntryState;
};

export type TextureLabOptions = {
  /** Where to look for textures. */
  scene: Object3D;
  /** A `WebGLRenderer`, for reading back textures with no file (compressed, data, generated). */
  renderer?: unknown;
  /** Textures to list whether or not the scene shows them yet, with names and source files. */
  textures?: readonly TextureInfo[];
  /** IndexedDB key prefix for saved swaps. `null` keeps swaps for this page only. Default `three-textures`. */
  storageKey?: string | null;
  /** Replaces the store (tests). */
  store?: SwapStore;
  /** After any swap, toggle or revert: redraw derived textures (atlases) from `bound`. */
  onSwap?: (event: SwapEvent) => void;
  /** Ask for a frame, for render-on-demand loops (R3F `frameloop="demand"`). */
  invalidate?: () => void;
};

export type EntryState = "original" | "swapped" | "showing-original";
export type LinkState = "off" | "live" | "paused";

export type TextureEntry = {
  id: string;
  kind: TextureKind;
  /** `ASTC`, `ETC2`, `webp`, `canvas`, `data`… */
  format: string;
  width: number;
  height: number;
  colorSpace: string;
  /** The file it came from, when known. */
  src: string | null;
  /** How many materials use it. */
  materials: number;
  state: EntryState;
  link: LinkState;
  /** Name of the file swapped in. */
  swapName: string | null;
  /** Why it can't be swapped, when it can't. */
  unsupported: string | null;
  /** Counts every change to what it shows: a cache key for thumbnails. */
  revision: number;
  /** One of the original textures. */
  texture: Texture;
};

type Item = {
  id: string;
  found: Found;
  kind: TextureKind;
  src: string | null;
  applied: Applied | null;
  blob: Blob | null;
  swapName: string | null;
  url: string | null;
  handle: FileSystemFileHandleLike | null;
  link: LinkState;
  lastModified: number;
  revision: number;
};

type PickerWindow = Window & {
  showOpenFilePicker?: (options: object) => Promise<FileSystemFileHandleLike[]>;
};

const LINK_POLL_MS = 600;

/** Decode to the same kind of object the texture held: WebGL ignores `flipY` for bitmaps. */
const decode = async (
  blob: Blob,
  like: unknown,
): Promise<{ image: SwapImage; url: string | null }> => {
  if (typeof ImageBitmap !== "undefined" && like instanceof ImageBitmap) {
    return {
      image: await createImageBitmap(blob, {
        premultiplyAlpha: "none",
        colorSpaceConversion: "none",
      }),
      url: null,
    };
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.src = url;
  await image.decode();

  return { image, url };
};

const drawToDataUrl = (
  draw: (context: CanvasRenderingContext2D) => void,
  width: number,
  height: number,
) => {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!);

  return canvas.toDataURL("image/png");
};

const fit = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height, 1));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export class TextureLab {
  private readonly options: TextureLabOptions;
  private readonly store: SwapStore;
  private readonly records = new Map<TextureSource, Item>();
  private readonly byId = new Map<string, Item>();
  /** Sources of rebind twins, so a refresh doesn't list them as textures of their own. */
  private readonly twinSources = new Set<TextureSource>();
  private readonly listeners = new Set<() => void>();
  private readonly restoring = new Set<string>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(options: TextureLabOptions) {
    this.options = options;
    this.store =
      options.store ??
      (options.storageKey === null
        ? memoryStore()
        : indexedDbStore(options.storageKey ?? "three-textures"));
    this.refresh();
  }

  /** Whether this browser can live-link a file (the File System Access API: Chrome, Edge). */
  static get canLink() {
    return (
      typeof window !== "undefined" &&
      typeof (window as PickerWindow).showOpenFilePicker === "function"
    );
  }

  /** Whether downloads and thumbnails can read textures back from the GPU. */
  get canReadBack() {
    return canReadBack(this.options.renderer);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Every texture, by name. */
  entries(): TextureEntry[] {
    return [...this.byId.values()]
      .map((record) => this.entryOf(record))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  entry(id: string): TextureEntry | null {
    const record = this.byId.get(id);

    return record ? this.entryOf(record) : null;
  }

  /**
   * Look at the scene again: textures that appeared get entries (and their saved swap back), a
   * rebind swap reaches slots mounted since. Entries whose textures left the scene stay while
   * swapped or registered, so their state isn't lost.
   */
  refresh() {
    if (this.disposed) {
      return;
    }

    const found = findTextures(this.options.scene);
    let changed = false;

    for (const info of this.options.textures ?? []) {
      if (!found.has(info.texture.source)) {
        found.set(info.texture.source, {
          source: info.texture.source,
          textures: new Set([info.texture]),
          refs: [],
          slots: new Set(),
          materials: new Set(),
        });
      }
    }

    const seen = new Set<TextureSource>();

    for (const [source, item] of found) {
      if (this.twinSources.has(source)) {
        continue;
      }

      seen.add(source);

      const record = this.records.get(source);

      if (record) {
        const before = record.found.materials.size;

        record.found = item;

        if (record.applied) {
          bindNewRefs(item, record.applied);
        }

        changed ||= before !== item.materials.size;
        continue;
      }

      this.add(item);
      changed = true;
    }

    for (const [source, record] of this.records) {
      if (!seen.has(source) && !record.applied && !this.isRegistered(source)) {
        this.records.delete(source);
        this.byId.delete(record.id);
        changed = true;
      }
    }

    if (changed) {
      this.notify();
    }
  }

  /** Swap `blob` (an image file) in for the texture `id`. */
  async swap(
    id: string,
    blob: Blob,
    {
      fileName = (blob as File).name ?? null,
      persist = true,
    }: { fileName?: string | null; persist?: boolean } = {},
  ) {
    const record = this.require(id);

    if (!canSwap(record.kind)) {
      throw new Error(`three-textures: "${id}" can't be swapped (${record.kind})`);
    }

    const { image, url } = await decode(blob, record.found.source.data);
    const previousUrl = record.url;

    record.applied = applyImage(record.found, record.kind, image, record.applied);

    if (record.applied.mode === "rebind") {
      this.twinSources.add(record.applied.source);
    }

    record.blob = blob;
    record.swapName = fileName || null;
    record.url = url;

    if (previousUrl && previousUrl !== url) {
      URL.revokeObjectURL(previousUrl);
    }

    if (persist) {
      await this.save(record);
    }

    this.changed(record);
  }

  /** A/B: show the original (`true`) or the swap (`false`). */
  async showOriginal(id: string, original: boolean) {
    const record = this.require(id);

    if (!record.applied || record.applied.showingOriginal === original) {
      return;
    }

    showOriginal(record.applied, original);
    await this.save(record);
    this.changed(record);
  }

  /** Back to the original, forgetting the swap. */
  async revert(id: string) {
    const record = this.require(id);

    this.stopLink(record);
    record.handle = null;
    await this.store.delete(id);

    if (!record.applied) {
      this.notify();

      return;
    }

    revertImage(record.applied);

    if (record.applied.mode === "rebind") {
      this.twinSources.delete(record.applied.source);
    }

    record.applied = null;
    record.blob = null;
    record.swapName = null;

    if (record.url) {
      URL.revokeObjectURL(record.url);
      record.url = null;
    }

    this.changed(record);
  }

  /** Every entry back to its original, and every saved swap cleared. */
  async revertAll() {
    for (const record of this.byId.values()) {
      if (record.applied || record.handle) {
        await this.revert(record.id);
      }
    }

    await this.store.clear();
  }

  /**
   * The pixels showing now as a file: the swapped file, else the original file when its URL is
   * known and fetchable, else a GPU readback as PNG.
   */
  async toBlob(id: string): Promise<{ blob: Blob; fileName: string }> {
    const record = this.require(id);
    const fallbackName = `${id}.png`;

    if (record.applied && !record.applied.showingOriginal && record.blob) {
      return { blob: record.blob, fileName: record.swapName ?? fallbackName };
    }

    if (record.src) {
      try {
        const response = await fetch(record.src);

        if (response.ok) {
          return { blob: await response.blob(), fileName: fileNameOf(record.src) ?? fallbackName };
        }
      } catch {
        // Cross-origin or gone: read it back instead.
      }
    }

    const renderer = this.options.renderer;

    if (!canReadBack(renderer)) {
      throw new Error(
        `three-textures: "${id}" has no file to download and the renderer can't read it back`,
      );
    }

    const texture = [...record.found.textures][0]!;
    const { width, height } = sizeOf(texture);

    return {
      blob: await readTextureBlob(renderer, texture, width, height),
      fileName: fallbackName,
    };
  }

  /** Save the pixels showing now to the downloads folder. */
  async download(id: string) {
    const { blob, fileName } = await this.toBlob(id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** A small picture of what's showing now, as a data URL; `null` when there's no way to draw it. */
  thumbnail(id: string, max = 96): string | null {
    const plan = this.thumbnailPlan(id, max);

    if (plan?.kind !== "readback") {
      return plan?.url ?? null;
    }

    const { renderer, texture, width, height } = plan;

    return drawToDataUrl(
      (context) => context.putImageData(readTexture(renderer, texture, width, height), 0, 0),
      width,
      height,
    );
  }

  /**
   * `thumbnail` without stalling the page on a GPU readback (see `readTextureAsync`): what the
   * panel uses, so drawing its rows never holds up a frame.
   */
  async thumbnailAsync(id: string, max = 96): Promise<string | null> {
    const plan = this.thumbnailPlan(id, max);

    if (plan?.kind !== "readback") {
      return plan?.url ?? null;
    }

    const { renderer, texture, width, height } = plan;
    const pixels = await readTextureAsync(renderer, texture, width, height);

    return drawToDataUrl((context) => context.putImageData(pixels, 0, 0), width, height);
  }

  /** How to draw a thumbnail: from the image itself, or by reading the texture back. */
  private thumbnailPlan(
    id: string,
    max: number,
  ):
    | { kind: "image"; url: string | null }
    | { kind: "readback"; renderer: WebGLRenderer; texture: Texture; width: number; height: number }
    | null {
    const record = this.require(id);
    const bound = boundTextures(record.found, record.applied)[0];

    if (!bound) {
      return null;
    }

    const data = bound.source.data as CanvasImageSource & { width: number; height: number };

    if (kindOf(bound) === "image" || (record.applied && !record.applied.showingOriginal)) {
      const { width, height } = fit(data.width, data.height, max);

      try {
        return {
          kind: "image",
          url: drawToDataUrl(
            (context) => context.drawImage(data, 0, 0, width, height),
            width,
            height,
          ),
        };
      } catch {
        return { kind: "image", url: null };
      }
    }

    const renderer = this.options.renderer;

    if (!canReadBack(renderer)) {
      return null;
    }

    const { width, height } = fit(sizeOf(bound).width, sizeOf(bound).height, max);

    return { kind: "readback", renderer, texture: bound, width, height };
  }

  /**
   * Live-link a file: pick it once, and every save re-applies it. Call from a click (the browser
   * shows a file picker, or asks to resume permission for a link restored after a reload).
   */
  async link(id: string) {
    const record = this.require(id);
    let handle = record.handle;

    if (handle) {
      const permission = (await handle.requestPermission?.({ mode: "read" })) ?? "granted";

      if (permission !== "granted") {
        return;
      }
    } else {
      const picker = (window as PickerWindow).showOpenFilePicker;

      if (!picker) {
        throw new Error(
          "three-textures: live links need the File System Access API (Chrome, Edge)",
        );
      }

      [handle] = (await picker({
        types: [
          {
            description: "Images",
            accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".avif"] },
          },
        ],
      })) as [FileSystemFileHandleLike];
    }

    const file = await handle.getFile();

    record.handle = handle;
    record.link = "live";
    record.lastModified = file.lastModified;
    await this.swap(id, file, { fileName: handle.name });
    this.startPolling();
  }

  /** Stop following the file; the last version stays swapped in. */
  async unlink(id: string) {
    const record = this.require(id);

    this.stopLink(record);
    record.handle = null;
    await this.save(record);
    this.notify();
  }

  dispose() {
    this.disposed = true;

    if (this.poll) {
      clearInterval(this.poll);
    }

    this.listeners.clear();
  }

  private add(item: Found) {
    const id = this.uniqueName(this.nameOf(item));
    const texture = [...item.textures][0]!;
    const registered = (this.options.textures ?? []).find(
      (info) => info.texture.source === item.source,
    );
    const record: Item = {
      id,
      found: item,
      kind: kindOf(texture),
      src: registered?.src ?? sourceUrlOf(texture),
      applied: null,
      blob: null,
      swapName: null,
      url: null,
      handle: null,
      link: "off",
      lastModified: 0,
      revision: 0,
    };

    this.records.set(item.source, record);
    this.byId.set(id, record);
    void this.restore(record);
  }

  private nameOf(item: Found) {
    const registered = (this.options.textures ?? []).find(
      (info) => info.texture.source === item.source,
    );

    if (registered) {
      return registered.name;
    }

    for (const texture of item.textures) {
      if (texture.name) {
        return texture.name;
      }
    }

    const url = sourceUrlOf([...item.textures][0]!);
    const file = url ? fileNameOf(url) : null;

    return file ? stem(file) : ([...item.slots][0] ?? "texture");
  }

  private uniqueName(name: string) {
    let unique = name;

    for (let n = 2; this.byId.has(unique); n += 1) {
      unique = `${name} ${n}`;
    }

    return unique;
  }

  private isRegistered(source: TextureSource) {
    return (this.options.textures ?? []).some((info) => info.texture.source === source);
  }

  private async restore(record: Item) {
    if (this.restoring.has(record.id)) {
      return;
    }

    this.restoring.add(record.id);

    try {
      const saved = await this.store.get(record.id);

      if (!saved || this.disposed || record.applied || !canSwap(record.kind)) {
        return;
      }

      await this.swap(record.id, saved.blob, { fileName: saved.fileName, persist: false });

      if (saved.showingOriginal) {
        await this.showOriginal(record.id, true);
      }

      if (saved.handle) {
        record.handle = saved.handle;
        record.link = "paused";
        this.notify();
      }
    } catch (error) {
      // oxlint-disable-next-line no-console -- a dev tool's one channel for a failed restore
      console.warn(`three-textures: couldn't restore the swap for "${record.id}"`, error);
    } finally {
      this.restoring.delete(record.id);
    }
  }

  private async save(record: Item) {
    if (!record.blob || !record.applied) {
      return;
    }

    const swap = {
      blob: record.blob,
      fileName: record.swapName,
      showingOriginal: record.applied.showingOriginal,
      handle: record.handle ?? undefined,
    };

    try {
      await this.store.set(record.id, swap);
    } catch (error) {
      try {
        // A file handle that won't clone (some browsers, test doubles): keep the swap without it.
        await this.store.set(record.id, { ...swap, handle: undefined });
      } catch {
        // oxlint-disable-next-line no-console -- a dev tool's one channel for a failed save
        console.warn(`three-textures: couldn't save the swap for "${record.id}"`, error);
      }
    }
  }

  private startPolling() {
    this.poll ??= setInterval(() => void this.checkLinks(), LINK_POLL_MS);
  }

  private async checkLinks() {
    let live = 0;

    for (const record of this.byId.values()) {
      if (record.link !== "live" || !record.handle) {
        continue;
      }

      live += 1;

      try {
        const file = await record.handle.getFile();

        if (file.lastModified !== record.lastModified) {
          record.lastModified = file.lastModified;
          await this.swap(record.id, file, { fileName: record.handle.name });
        }
      } catch {
        // Mid-save, moved, or permission gone: pause rather than spin.
        record.link = "paused";
        this.notify();
      }
    }

    if (live === 0 && this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  private stopLink(record: Item) {
    record.link = "off";
  }

  private require(id: string) {
    const record = this.byId.get(id);

    if (!record) {
      throw new Error(`three-textures: no texture "${id}"`);
    }

    return record;
  }

  private entryOf(record: Item): TextureEntry {
    const texture = [...record.found.textures][0]!;
    const { width, height } = sizeOf(texture);

    return {
      id: record.id,
      kind: record.kind,
      format: formatOf(texture),
      width,
      height,
      colorSpace: texture.colorSpace,
      src: record.src,
      materials: record.found.materials.size,
      state: !record.applied
        ? "original"
        : record.applied.showingOriginal
          ? "showing-original"
          : "swapped",
      link: record.link,
      swapName: record.swapName,
      unsupported: canSwap(record.kind)
        ? null
        : "cube, 3D, array, video and render-target textures can't be swapped",
      revision: record.revision,
      texture,
    };
  }

  private changed(record: Item) {
    record.revision += 1;
    this.options.onSwap?.({
      id: record.id,
      textures: [...record.found.textures],
      bound: boundTextures(record.found, record.applied),
      state: this.entryOf(record).state,
    });
    this.options.invalidate?.();
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
