/**
 * The camera list: one row per camera with its kind, name, whether it's drawing right now and how
 * often, and its projection at a glance. A row opens to show where the camera is and how it
 * projects, read live. A frustum toggle per row draws the camera's view volume in the scene.
 */
import type { CameraKind } from "../core/discover.ts";
import type { CameraDetails, CameraEntry, CameraLab } from "../core/lab.ts";
import { injectStyles } from "./styles.ts";

export type CameraPanel = {
  element: HTMLElement;
  /** Paint the panel when it's not in a dev-panel card, `dark` or `light`. Default dark. */
  setTheme(theme: "dark" | "light"): void;
  /** Re-read the scene now (the panel also does a few times a second while shown). */
  refresh(): void;
  /** Pause or resume the live updates, e.g. while a host tab is hidden. */
  setActive(active: boolean): void;
  dispose(): void;
};

type Row = {
  li: HTMLLIElement;
  name: HTMLElement;
  live: HTMLElement;
  meta: HTMLElement;
  kind: HTMLElement;
  helper: HTMLButtonElement;
  details: HTMLElement;
  open: boolean;
};

/** Live badges and open rows update this often, ms. */
const TICK_MS = 250;

/** Line icons on a 24 grid, stroked in the text colour (styles.ts). */
const KIND_ICONS: Record<CameraKind, string> = {
  perspective: '<rect x="2" y="7" width="12" height="10" rx="2"/><path d="m14 10.5 7-4v11l-7-4"/>',
  orthographic: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18"/>',
  array:
    '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  cube: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  other: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};

const ICONS = {
  frustum: '<path d="M3 12 20 5v14Z"/><path d="M20 5v14"/><circle cx="3" cy="12" r="1"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};

const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

const icon = (name: keyof typeof ICONS, label: string, extra = "") =>
  `<button type="button" class="tcm-icon ${extra}" data-action="${name}" title="${label}" aria-label="${label}">${svg(ICONS[name])}</button>`;

const trim = (value: number, digits = 2) => {
  const fixed = value.toFixed(digits);

  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
};

const range = (near: number, far: number) => `${trim(near)}–${trim(far)}`;

const triple = (values: readonly number[], digits = 2) =>
  values.map((value) => trim(value, digits)).join("  ");

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

/** The row's second line: how it projects, at a glance. */
const describe = (entry: CameraEntry, details: CameraDetails | null) => {
  const projection = details?.projection;
  const parts: string[] = [];

  if (entry.kind === "cube") {
    parts.push("cube · 6 faces");
  } else if (projection?.fov !== undefined) {
    parts.push(`fov ${trim(projection.fov, 1)}°`, range(projection.near, projection.far));

    if (projection.aspect !== undefined) {
      parts.push(trim(projection.aspect));
    }
  } else if (projection) {
    parts.push("ortho", `zoom ${trim(projection.zoom)}`, range(projection.near, projection.far));
  } else {
    parts.push(entry.kind);
  }

  if (!entry.inScene) {
    parts.push("not in scene");
  }

  return parts.join(" · ");
};

/** The open row's facts, as `<dt>` / `<dd>` pairs. */
const detailRows = (entry: CameraEntry, details: CameraDetails) => {
  const { projection } = details;
  const rows: [string, string][] = [
    ["position", triple(details.position)],
    ["rotation", `${triple(details.rotation, 1)} °`],
  ];

  if (projection?.fov !== undefined) {
    rows.push(["fov", `${trim(projection.fov, 1)}°`]);
    rows.push(["aspect", trim(projection.aspect ?? 0, 3)]);
  }

  if (projection?.left !== undefined) {
    rows.push([
      "frustum",
      `l ${trim(projection.left)} r ${trim(projection.right!)} t ${trim(projection.top!)} b ${trim(projection.bottom!)}`,
    ]);
  }

  if (projection) {
    rows.push(["near / far", `${trim(projection.near, 3)} / ${trim(projection.far)}`]);
    rows.push(["zoom", trim(projection.zoom)]);
  }

  rows.push(["drawing", entry.live ? `${entry.fps} fps` : "no"]);
  rows.push([
    "in",
    entry.inScene ? entry.path.join(" › ") || "scene" : "the renderer only (not in the scene)",
  ]);

  return rows.map(([term, value]) => `<dt>${term}</dt><dd>${escape(value)}</dd>`).join("");
};

export const createCameraPanel = (lab: CameraLab): CameraPanel => {
  injectStyles();

  const element = document.createElement("div");

  element.className = "tcm tcm-panel";
  element.innerHTML = `
    <div class="tcm-toolbar">
      <input type="search" class="tcm-search" placeholder="Filter by name…" autocomplete="off" spellcheck="false" aria-label="Filter cameras" />
      ${icon("refresh", "Look for new cameras")}
    </div>
    <ul class="tcm-list"></ul>
    <div class="tcm-empty" hidden>No cameras yet. The one the renderer draws with shows up on its first frame.</div>
  `;

  const search = element.querySelector<HTMLInputElement>(".tcm-search")!;
  const list = element.querySelector<HTMLUListElement>(".tcm-list")!;
  const empty = element.querySelector<HTMLElement>(".tcm-empty")!;
  const rows = new Map<string, Row>();
  let timer: ReturnType<typeof setInterval> | null = null;

  const makeRow = (entry: CameraEntry): Row => {
    const li = document.createElement("li");
    const id = entry.id;

    li.className = "tcm-row";
    li.innerHTML = `
      <div class="tcm-head">
        <span class="tcm-kind" title="${entry.kind} camera">${svg(KIND_ICONS[entry.kind])}</span>
        <button type="button" class="tcm-text" data-action="open" aria-expanded="false">
          <span class="tcm-name-line"><span class="tcm-name"></span><span class="tcm-live"></span></span>
          <span class="tcm-meta"></span>
        </button>
        <div class="tcm-actions">
          ${icon("frustum", "Show its frustum in the scene")}
          ${icon("chevron", "Details", "tcm-chevron")}
        </div>
      </div>
      <dl class="tcm-details"></dl>
    `;

    const row: Row = {
      li,
      name: li.querySelector(".tcm-name")!,
      live: li.querySelector(".tcm-live")!,
      meta: li.querySelector(".tcm-meta")!,
      kind: li.querySelector(".tcm-kind")!,
      helper: li.querySelector<HTMLButtonElement>('[data-action="frustum"]')!,
      details: li.querySelector(".tcm-details")!,
      open: false,
    };

    row.name.textContent = id;
    row.name.title = id;
    li.addEventListener("click", (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset
        .action;
      const current = lab.entry(id);

      if (!current) {
        return;
      }

      if (action === "open" || action === "chevron") {
        row.open = !row.open;
        update(row, current);
      } else if (action === "frustum") {
        lab.setHelper(id, !current.helper);
      }
    });

    return row;
  };

  const update = (row: Row, entry: CameraEntry) => {
    const open = row.open;
    const details = lab.details(entry.id);

    row.li.classList.toggle("is-live", entry.live);
    row.li.classList.toggle("is-open", open);
    row.live.textContent = entry.live ? `live · ${entry.fps} fps` : "";
    row.meta.textContent = describe(entry, details);
    row.meta.title = row.meta.textContent;
    row.helper.disabled = !entry.canHelp;
    row.helper.setAttribute("aria-pressed", String(entry.helper));
    row.helper.title = entry.helper ? "Hide its frustum" : "Show its frustum in the scene";
    row.helper.setAttribute("aria-label", row.helper.title);

    for (const toggle of row.li.querySelectorAll('[data-action="open"], [data-action="chevron"]')) {
      toggle.setAttribute("aria-expanded", String(open));
    }

    if (open && details) {
      row.details.innerHTML = detailRows(entry, details);
    }
  };

  const filter = () => {
    const query = search.value.trim().toLowerCase();

    for (const [id, row] of rows) {
      row.li.classList.toggle("is-hidden", query.length > 0 && !id.toLowerCase().includes(query));
    }
  };

  /** Rows in, rows out, then every row's live state. */
  const render = () => {
    const entries = lab.entries();
    const ids = new Set(entries.map((entry) => entry.id));

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
        list.append(row.li);
      }

      update(row, entry);
    }

    empty.hidden = entries.length > 0;
    filter();
    element.dataset.count = String(entries.length);
    element.dispatchEvent(new CustomEvent("tcm-count", { detail: entries.length }));
  };

  element.querySelector('[data-action="refresh"]')!.addEventListener("click", () => lab.refresh());
  search.addEventListener("input", filter);

  const unsubscribe = lab.subscribe(render);

  const setActive = (active: boolean) => {
    if (active && !timer) {
      lab.refresh();
      render();
      timer = setInterval(() => {
        lab.refresh();
        render();
      }, TICK_MS);
    } else if (!active && timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  render();
  setActive(true);

  return {
    element,
    setTheme: (theme) => {
      // In a dev-panel card the frame's palette (`--perf-*`) applies; elsewhere the panel's own.
      if (element.closest(".perf-hud__card")) {
        delete element.dataset.theme;
      } else {
        element.dataset.theme = theme;
      }
    },
    refresh: () => lab.refresh(),
    setActive,
    dispose: () => {
      setActive(false);
      unsubscribe();
      element.remove();
    },
  };
};
