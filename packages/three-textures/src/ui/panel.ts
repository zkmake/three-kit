/**
 * The texture panel as an element: search, the list, and each texture's actions. `mountTexturePanel`
 * floats it in a docked card; a host with its own dev panel can put `element` in a tab instead.
 */
import { type TextureEntry, TextureLab } from "../core/lab.ts";
import { fileNameOf } from "../core/names.ts";
import { injectStyles } from "./styles.ts";

export type PanelEdge = "left" | "right" | "top" | "bottom";

export type TexturePanel = {
  element: HTMLElement;
  /** Paint the preview, and the panel when it's not in a dev-panel card, `dark` or `light`. Default dark. */
  setTheme(theme: "dark" | "light"): void;
  /** Which screen edge the panel sits on: the preview opens beside it, on the side facing away. */
  setEdge(edge: PanelEdge): void;
  /** Re-read the scene now (the panel also does every couple of seconds while shown). */
  refresh(): void;
  /** Pause or resume the periodic re-read, e.g. while a host tab is hidden. */
  setActive(active: boolean): void;
  dispose(): void;
};

/** Line icons on a 24 grid, stroked in the button's colour (styles.ts). */
const ICONS = {
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  replace:
    '<path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m3 17 5-5 4 4"/><path d="M18 11V3"/><path d="m14.5 6.5 3.5-3.5 3.5 3.5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  // Half filled: before and after.
  compare: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
  revert: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};

const icon = (name: keyof typeof ICONS, label: string) =>
  `<button type="button" class="ttx-icon" data-action="${name}" title="${label}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg></button>`;

/** Set a button's tooltip and accessible name together. */
const label = (button: HTMLButtonElement, text: string) => {
  button.title = text;
  button.setAttribute("aria-label", text);
};

/** What Download saves, as `lab.toBlob` picks it: the swap, the source file, or a readback. */
const downloadLabel = (entry: TextureEntry) => {
  if (entry.state === "swapped" && entry.swapName) {
    return `Download ${entry.swapName}, the swap`;
  }

  const file = entry.src ? fileNameOf(entry.src) : null;

  return file
    ? `Download ${file}, the source file`
    : `Download ${entry.id}.png, read back from the GPU`;
};

type Row = {
  li: HTMLLIElement;
  thumb: HTMLImageElement;
  name: HTMLDivElement;
  meta: HTMLDivElement;
  swap: HTMLDivElement;
  file: HTMLInputElement;
  buttons: Record<"download" | "replace" | "link" | "compare" | "revert", HTMLButtonElement>;
  /** `revision:state` the thumbnail was drawn at. */
  drawn: string;
};

const REFRESH_MS = 2000;
/**
 * Just after the panel opens, look again every `SETTLE_STEP_MS` for `SETTLE_MS`, hidden or not:
 * textures that load after mount (R3F scenes, async loaders) show up at once, not a poll later.
 */
const SETTLE_MS = 3000;
const SETTLE_STEP_MS = 250;
const THUMBS_PER_TICK = 4;

type PreviewSide = "left" | "right" | "above" | "below";

/** The preview's side for each docked edge: toward the middle of the screen. */
const FACING: Record<PanelEdge, PreviewSide> = {
  left: "right",
  right: "left",
  top: "below",
  bottom: "above",
};
/** Between the panel and the preview, and between the preview and the window's edge. */
const PREVIEW_GAP = 8;
const PREVIEW_MARGIN = 8;
/** Smallest side worth opening on, in px; below it the preview takes the roomiest side. */
const PREVIEW_MIN = 160;

const describe = (entry: TextureEntry) => {
  const parts = [
    entry.width && entry.height ? `${entry.width}×${entry.height}` : null,
    entry.format,
    entry.colorSpace === "srgb" ? "sRGB" : null,
    entry.materials > 0
      ? `${entry.materials} mat${entry.materials === 1 ? "" : "s"}`
      : "not in scene",
  ];

  return parts.filter(Boolean).join(" · ");
};

export const createTexturePanel = (lab: TextureLab, { canLink = true } = {}): TexturePanel => {
  injectStyles();

  const element = document.createElement("div");

  element.className = "ttx ttx-panel";
  element.innerHTML = `
    <div class="ttx-toolbar">
      <input type="search" class="ttx-search" placeholder="Filter by name…" autocomplete="off" spellcheck="false" aria-label="Filter textures" />
      ${icon("refresh", "Look for new textures")}
      <button type="button" class="ttx-text-button" data-action="reset-all" title="Put every texture back and forget saved swaps" disabled>Reset all</button>
    </div>
    <div class="ttx-status" role="status"></div>
    <ul class="ttx-list"></ul>
  `;

  const search = element.querySelector<HTMLInputElement>(".ttx-search")!;
  const status = element.querySelector<HTMLDivElement>(".ttx-status")!;
  const list = element.querySelector<HTMLUListElement>(".ttx-list")!;
  const resetAll = element.querySelector<HTMLButtonElement>('[data-action="reset-all"]')!;
  const rows = new Map<string, Row>();
  const linking = canLink && TextureLab.canLink;

  const preview = document.createElement("div");

  preview.className = "ttx ttx-preview";
  preview.hidden = true;
  preview.innerHTML = `<img alt="" /><span class="ttx-preview-label"></span>`;
  document.body.append(preview);

  const previewImage = preview.querySelector("img")!;
  const previewLabel = preview.querySelector("span")!;
  let previewing: string | null = null;
  let edge: PanelEdge | null = null;
  let placeFrame = 0;
  let thumbQueue: string[] = [];
  let thumbTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const say = (message: string, error = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", error);
  };

  const run = async (work: () => Promise<unknown>) => {
    try {
      say("");
      await work();
    } catch (error) {
      say((error as Error).message.replace(/^three-textures: /, ""), true);
    }
  };

  const showPreview = (id: string) => {
    const url = lab.thumbnail(id, 1024);

    if (!url) {
      say("No way to draw this one: it has no file and the renderer can't read it back.", true);

      return;
    }

    previewing = id;
    previewImage.src = url;
    previewLabel.textContent = id;
    preview.hidden = false;

    // Follow the panel while open: it can be dragged, the list scrolled, the window resized.
    if (!placeFrame) {
      const follow = () => {
        placePreview();
        placeFrame = requestAnimationFrame(follow);
      };

      follow();
    }
  };

  const hidePreview = () => {
    previewing = null;
    preview.hidden = true;
    cancelAnimationFrame(placeFrame);
    placeFrame = 0;
  };

  /**
   * Put the preview right beside the panel (its dev-panel frame, when it has one), on the side
   * facing away from the edge it's docked to, or whichever side has the most room, level with the
   * row it shows. It shrinks to the room there and stays on screen.
   */
  const placePreview = () => {
    const anchor = element.closest<HTMLElement>(".perf-hud") ?? element;
    const box = anchor.getBoundingClientRect();
    const row = (previewing ? rows.get(previewing)?.li : null)?.getBoundingClientRect() ?? box;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const room = {
      left: box.left - PREVIEW_GAP - PREVIEW_MARGIN,
      right: width - box.right - PREVIEW_GAP - PREVIEW_MARGIN,
      above: box.top - PREVIEW_GAP - PREVIEW_MARGIN,
      below: height - box.bottom - PREVIEW_GAP - PREVIEW_MARGIN,
    };
    const facing = edge ? FACING[edge] : room.left > room.right ? "left" : "right";
    const roomiest = (Object.keys(room) as PreviewSide[]).reduce((best, side) =>
      room[side] > room[best] ? side : best,
    );
    const side = room[facing] >= PREVIEW_MIN ? facing : roomiest;
    const across = side === "left" || side === "right";
    const maxWidth = across ? room[side] : width - 2 * PREVIEW_MARGIN;
    const maxHeight = across ? height - 2 * PREVIEW_MARGIN : room[side];

    preview.dataset.side = side;
    preview.style.maxWidth = `${Math.max(PREVIEW_MIN, Math.min(maxWidth, 560))}px`;
    // Leave room for the padding and the label under the image.
    previewImage.style.maxHeight = `${Math.max(PREVIEW_MIN, maxHeight - 40)}px`;

    const w = preview.offsetWidth;
    const h = preview.offsetHeight;
    let x: number;
    let y: number;

    if (across) {
      x = side === "left" ? box.left - PREVIEW_GAP - w : box.right + PREVIEW_GAP;
      y = row.top + row.height / 2 - h / 2;
    } else {
      x = box.left + box.width / 2 - w / 2;
      y = side === "above" ? box.top - PREVIEW_GAP - h : box.bottom + PREVIEW_GAP;
    }

    const clamp = (value: number, size: number, limit: number) =>
      Math.min(
        Math.max(value, PREVIEW_MARGIN),
        Math.max(PREVIEW_MARGIN, limit - size - PREVIEW_MARGIN),
      );

    preview.style.left = `${Math.round(clamp(x, w, width))}px`;
    preview.style.top = `${Math.round(clamp(y, h, height))}px`;
  };

  // One batch at a time: each thumbnail that needs a GPU readback waits on a fence instead of the
  // main thread (lab.thumbnailAsync), so a batch can span frames.
  let drawing = false;

  const drawThumbs = async () => {
    thumbTimer = null;
    drawing = true;

    for (const id of thumbQueue.splice(0, THUMBS_PER_TICK)) {
      const row = rows.get(id);
      const url = row ? await lab.thumbnailAsync(id, 72).catch(() => null) : null;

      if (row && url && rows.get(id) === row) {
        row.thumb.src = url;
      }
    }

    drawing = false;

    if (thumbQueue.length > 0) {
      thumbTimer = setTimeout(() => void drawThumbs(), 16);
    }
  };

  const queueThumb = (id: string) => {
    if (!thumbQueue.includes(id)) {
      thumbQueue.push(id);
    }

    if (!drawing) {
      thumbTimer ??= setTimeout(() => void drawThumbs(), 0);
    }
  };

  const makeRow = (entry: TextureEntry): Row => {
    const li = document.createElement("li");

    li.className = "ttx-row";
    li.innerHTML = `
      <button type="button" class="ttx-thumb" data-action="preview" title="Preview"><img alt="" /></button>
      <div class="ttx-text"><div class="ttx-name"></div><div class="ttx-meta"></div><div class="ttx-swap-name"></div></div>
      <div class="ttx-actions">
        ${icon("download", "Download")}
        ${icon("replace", "Swap in an image file, or drop one on the row")}
        ${linking ? icon("link", "Live-link a file: every save shows here") : ""}
        ${icon("compare", "A/B: show the original")}
        ${icon("revert", "Undo the swap: put the original back")}
      </div>
      <input type="file" accept="image/*" hidden />
    `;

    const button = (name: string) =>
      li.querySelector<HTMLButtonElement>(`[data-action="${name}"]`) ??
      document.createElement("button");
    const row: Row = {
      li,
      thumb: li.querySelector(".ttx-thumb img")!,
      name: li.querySelector(".ttx-name")!,
      meta: li.querySelector(".ttx-meta")!,
      swap: li.querySelector(".ttx-swap-name")!,
      file: li.querySelector('input[type="file"]')!,
      buttons: {
        download: button("download"),
        replace: button("replace"),
        link: button("link"),
        compare: button("compare"),
        revert: button("revert"),
      },
      drawn: "",
    };
    const id = entry.id;

    row.name.textContent = id;
    li.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset
        .action;
      const current = lab.entry(id);

      if (!action || !current) {
        return;
      }

      if (action === "preview") {
        if (previewing === id) {
          hidePreview();
        } else {
          showPreview(id);
        }
      } else if (action === "download") {
        void run(() => lab.download(id));
      } else if (action === "replace") {
        row.file.click();
      } else if (action === "link") {
        void run(() => (current.link === "live" ? lab.unlink(id) : lab.link(id)));
      } else if (action === "compare") {
        void run(() => lab.showOriginal(id, current.state === "swapped"));
      } else if (action === "revert") {
        void run(() => lab.revert(id));
      }
    });
    row.file.addEventListener("change", () => {
      const file = row.file.files?.[0];

      row.file.value = "";

      if (file) {
        void run(() => lab.swap(id, file));
      }
    });
    li.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types.includes("Files") && !lab.entry(id)?.unsupported) {
        event.preventDefault();
        li.classList.add("is-drop");
      }
    });
    li.addEventListener("dragleave", () => li.classList.remove("is-drop"));
    li.addEventListener("drop", (event) => {
      event.preventDefault();
      li.classList.remove("is-drop");

      const file = event.dataTransfer?.files[0];

      if (file) {
        void run(() => lab.swap(id, file));
      }
    });

    return row;
  };

  const update = (row: Row, entry: TextureEntry) => {
    const swapped = entry.state !== "original";
    const { buttons } = row;

    row.li.classList.toggle("is-swapped", entry.state === "swapped");
    row.li.classList.toggle("is-showing-original", entry.state === "showing-original");
    row.li.classList.toggle("is-unsupported", entry.unsupported !== null);
    row.li.title = entry.unsupported ?? "";
    row.meta.textContent = describe(entry);

    row.swap.hidden = entry.swapName === null;
    row.swap.textContent =
      entry.state === "showing-original"
        ? `original · swap: ${entry.swapName}`
        : `→ ${entry.swapName ?? ""}`;
    row.swap.title = row.swap.textContent;

    label(buttons.download, downloadLabel(entry));
    buttons.replace.disabled = entry.unsupported !== null;
    label(buttons.replace, entry.unsupported ?? "Swap in an image file, or drop one on the row");
    buttons.link.disabled = entry.unsupported !== null;
    buttons.link.classList.toggle("is-live", entry.link === "live");
    buttons.link.classList.toggle("is-paused", entry.link === "paused");
    buttons.link.setAttribute("aria-pressed", String(entry.link !== "off"));
    label(
      buttons.link,
      entry.link === "live"
        ? "Live: every save of the file shows here. Click to stop."
        : entry.link === "paused"
          ? "Live link paused. Click to resume."
          : "Live-link a file: every save shows here",
    );
    // A/B and undo only mean something once there's a swap; until then they stay out of the way.
    buttons.compare.disabled = !swapped;
    buttons.compare.classList.toggle("is-on", entry.state === "showing-original");
    buttons.compare.setAttribute("aria-pressed", String(entry.state === "showing-original"));
    label(
      buttons.compare,
      entry.state === "showing-original"
        ? "A/B: showing the original. Show the swap"
        : "A/B: show the original",
    );
    buttons.revert.disabled = !swapped && entry.link === "off";

    const key = `${entry.revision}:${entry.state}`;

    if (row.drawn !== key) {
      row.drawn = key;
      queueThumb(entry.id);

      if (previewing === entry.id) {
        showPreview(entry.id);
      }
    }
  };

  const filter = () => {
    const query = search.value.trim().toLowerCase();

    for (const [id, row] of rows) {
      row.li.classList.toggle("is-hidden", query.length > 0 && !id.toLowerCase().includes(query));
    }
  };

  const render = () => {
    const entries = lab.entries();
    const ids = new Set(entries.map((entry) => entry.id));
    let added = false;

    for (const [id, row] of rows) {
      if (!ids.has(id)) {
        row.li.remove();
        rows.delete(id);
      }
    }

    for (const entry of entries) {
      let row = rows.get(entry.id);

      if (!row) {
        row = makeRow(entry);
        rows.set(entry.id, row);
        added = true;
      }

      update(row, entry);
    }

    if (added) {
      for (const entry of entries) {
        list.append(rows.get(entry.id)!.li);
      }
    }

    if (entries.length === 0) {
      say("No textures in the scene yet.");
    } else if (status.textContent === "No textures in the scene yet.") {
      say("");
    }

    resetAll.disabled = !entries.some(
      (entry) => entry.state !== "original" || entry.link !== "off",
    );
    element.dataset.count = String(entries.length);
    element.dispatchEvent(new CustomEvent("ttx-count", { detail: entries.length }));
    filter();
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node;

    // A press on the panel's frame (its grip, say) keeps the preview: it follows a drag.
    const frame = element.closest(".perf-hud") ?? element;

    if (previewing && !preview.contains(target) && !frame.contains(target)) {
      hidePreview();
    }
  };

  element.querySelector('[data-action="refresh"]')!.addEventListener("click", () => lab.refresh());
  resetAll.addEventListener("click", () => void run(() => lab.revertAll()));
  search.addEventListener("input", filter);
  document.addEventListener("pointerdown", onPointerDown);

  const unsubscribe = lab.subscribe(render);
  const onVisibility = () => {
    if (refreshTimer && document.visibilityState === "visible") {
      lab.refresh();
    }
  };

  document.addEventListener("visibilitychange", onVisibility);

  const setActive = (active: boolean) => {
    if (active && !refreshTimer) {
      const opened = performance.now();
      const tick = () => {
        const settling = performance.now() - opened < SETTLE_MS;

        if (settling || document.visibilityState === "visible") {
          lab.refresh();
        }

        refreshTimer = setTimeout(tick, settling ? SETTLE_STEP_MS : REFRESH_MS);
      };

      lab.refresh();
      refreshTimer = setTimeout(tick, SETTLE_STEP_MS);
    } else if (!active && refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  };

  render();
  setActive(true);

  return {
    element,
    setEdge: (next) => {
      edge = next;
    },
    refresh: () => lab.refresh(),
    setTheme: (theme) => {
      preview.dataset.theme = theme;

      // In a dev-panel card the frame's palette (\`--perf-*\`) applies; elsewhere the panel's own.
      if (element.closest(".perf-hud__card")) {
        delete element.dataset.theme;
      } else {
        element.dataset.theme = theme;
      }
    },
    setActive,
    dispose: () => {
      setActive(false);
      hidePreview();
      unsubscribe();

      if (thumbTimer) {
        clearTimeout(thumbTimer);
      }

      thumbQueue = [];
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
      preview.remove();
      element.remove();
    },
  };
};
