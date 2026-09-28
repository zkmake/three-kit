/**
 * The texture panel as an element: search, the list, and each texture's actions. `mountTexturePanel`
 * floats it in a docked card; a host with its own dev panel can put `element` in a tab instead.
 */
import { type TextureEntry, TextureLab } from "../core/lab.ts";
import { injectStyles } from "./styles.ts";

export type PanelEdge = "left" | "right" | "top" | "bottom";

export type TexturePanel = {
  element: HTMLElement;
  /** Paint the preview, and the panel when it's not in a dev-panel card, `dark` or `light`. Default dark. */
  setTheme(theme: "dark" | "light"): void;
  /** Which screen edge the panel sits on: the preview opens on the other side. */
  setEdge(edge: PanelEdge): void;
  /** Re-read the scene now (the panel also does every couple of seconds while shown). */
  refresh(): void;
  /** Pause or resume the periodic re-read, e.g. while a host tab is hidden. */
  setActive(active: boolean): void;
  dispose(): void;
};

const ICONS = {
  download: '<path fill="currentColor" d="M7 1h2v6h2.5L8 10.5 4.5 7H7V1zm-5 12h12v2H2v-2z"/>',
  replace: '<path fill="currentColor" d="M5 2 1 6h3v4h2V6h3L5 2zm6 12 4-4h-3V6h-2v4H7l4 4z"/>',
  link: '<path fill="currentColor" d="M6.5 9.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2L8 3.8l1.1 1.1 1.1-1.1a1.5 1.5 0 0 1 2.1 2.1l-2.6 2.6a1.5 1.5 0 0 1-2.1 0L6.5 9.5zm3-3a3 3 0 0 0-4.2 0L2.7 9.1a3 3 0 0 0 4.2 4.2L8 12.2l-1.1-1.1-1.1 1.1a1.5 1.5 0 0 1-2.1-2.1l2.6-2.6a1.5 1.5 0 0 1 2.1 0L9.5 6.5z"/>',
  compare:
    '<path fill="currentColor" d="M8 3C4.5 3 1.7 5.2 0 8c1.7 2.8 4.5 5 8 5s6.3-2.2 8-5c-1.7-2.8-4.5-5-8-5zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>',
  revert:
    '<path fill="currentColor" d="M5 4V2L1 5l4 3V6h5a3 3 0 0 1 0 6H5v2h5a5 5 0 0 0 0-10H5z"/>',
  refresh:
    '<path fill="currentColor" d="M13.6 2.4V6H10l1.4-1.4A4.5 4.5 0 1 0 12.5 9h1.6a6 6 0 1 1-1.6-5.7l1.1-.9z"/>',
};

const icon = (name: keyof typeof ICONS, label: string) =>
  `<button type="button" class="ttx-icon" data-action="${name}" title="${label}" aria-label="${label}"><svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg></button>`;

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
  preview.dataset.side = "left";
  preview.innerHTML = `<img alt="" /><span class="ttx-preview-label"></span>`;
  document.body.append(preview);

  const previewImage = preview.querySelector("img")!;
  const previewLabel = preview.querySelector("span")!;
  let previewing: string | null = null;
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
  };

  const hidePreview = () => {
    previewing = null;
    preview.hidden = true;
  };

  const drawThumbs = () => {
    thumbTimer = null;

    for (const id of thumbQueue.splice(0, THUMBS_PER_TICK)) {
      const row = rows.get(id);
      const url = row ? lab.thumbnail(id, 72) : null;

      if (row && url) {
        row.thumb.src = url;
      }
    }

    if (thumbQueue.length > 0) {
      thumbTimer = setTimeout(drawThumbs, 16);
    }
  };

  const queueThumb = (id: string) => {
    if (!thumbQueue.includes(id)) {
      thumbQueue.push(id);
    }

    thumbTimer ??= setTimeout(drawThumbs, 0);
  };

  const makeRow = (entry: TextureEntry): Row => {
    const li = document.createElement("li");

    li.className = "ttx-row";
    li.innerHTML = `
      <button type="button" class="ttx-thumb" data-action="preview" title="Preview"><img alt="" /></button>
      <div class="ttx-text"><div class="ttx-name"></div><div class="ttx-meta"></div><div class="ttx-swap-name"></div></div>
      <div class="ttx-actions">
        ${icon("download", "Download")}
        ${icon("replace", "Replace with an image file (or drop one on the row)")}
        ${linking ? icon("link", "Live-link a file: every save shows here") : ""}
        ${icon("compare", "Show the original")}
        ${icon("revert", "Put the original back")}
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

    buttons.replace.disabled = entry.unsupported !== null;
    buttons.link.disabled = entry.unsupported !== null;
    buttons.link.classList.toggle("is-live", entry.link === "live");
    buttons.link.classList.toggle("is-paused", entry.link === "paused");
    buttons.link.title =
      entry.link === "live"
        ? "Live: every save of the file shows here. Click to stop."
        : entry.link === "paused"
          ? "Live link paused. Click to resume."
          : "Live-link a file: every save shows here";
    buttons.compare.disabled = !swapped;
    buttons.compare.classList.toggle("is-on", entry.state === "showing-original");
    buttons.compare.title =
      entry.state === "showing-original" ? "Show the swap" : "Show the original";
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

    if (previewing && !preview.contains(target) && !element.contains(target)) {
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
    setEdge: (edge) => {
      // Open the preview on the side away from the panel.
      preview.dataset.side = edge === "left" ? "right" : "left";
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
