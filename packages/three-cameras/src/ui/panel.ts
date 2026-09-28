/**
 * The camera list: one row per camera with its kind, name, whether it's drawing right now and how
 * often, and its projection at a glance. Pick a row and it opens into the camera's controls: its
 * position, rotation and lens as fields you can type in or scrub (drag a field's label), copy as
 * code, and saved views to fly back to. Per row: look through it, and draw its frustum.
 */
import type { CameraKind } from "../core/discover.ts";
import type { CameraDetails, CameraEntry, CameraLab, CameraPatch } from "../core/lab.ts";
import { capturePose, poseToCode } from "../core/pose.ts";
import { injectStyles } from "./styles.ts";

export type CameraPanel = {
  element: HTMLElement;
  /** Paint the panel when it's not in a dev-panel card, `dark` or `light`. Default dark. */
  setTheme(theme: "dark" | "light"): void;
  /** Re-read the scene now (the panel also does a few times a second while shown). */
  refresh(): void;
  /** Pause or resume the live updates, e.g. while a host tab is hidden. */
  setActive(active: boolean): void;
  /** A camera's row, for a host that lines things up with it (the timeline's lanes). */
  row(id: string): HTMLElement | null;
  /** Hear each redraw of the rows. */
  onRender(listener: () => void): () => void;
  dispose(): void;
};

export type CameraPanelOptions = {
  /** Put a motion-path toggle on each row, for when the rows are a timeline's sidebar. */
  paths?: boolean;
};

type FieldKey = "px" | "py" | "pz" | "rx" | "ry" | "rz" | "fov" | "near" | "far" | "zoom";

type Controls = {
  fields: Map<FieldKey, HTMLInputElement>;
  readout: HTMLElement;
  views: HTMLUListElement;
  copy: HTMLButtonElement;
  /** What the saved-view list was drawn from, to redraw only when it changes. */
  viewsDrawn: string;
};

type Row = {
  li: HTMLLIElement;
  name: HTMLElement;
  badge: HTMLElement;
  meta: HTMLElement;
  look: HTMLButtonElement;
  helper: HTMLButtonElement;
  path: HTMLButtonElement | null;
  details: HTMLElement;
  controls: Controls | null;
  open: boolean;
};

/** Live badges and open rows update this often, ms. */
const TICK_MS = 250;

/** Per field: the step a typed arrow key takes and what a pixel of scrubbing adds. */
const FIELDS: Record<FieldKey, { label: string; step: number; perPixel: number; min?: number }> = {
  px: { label: "x", step: 0.01, perPixel: 0.02 },
  py: { label: "y", step: 0.01, perPixel: 0.02 },
  pz: { label: "z", step: 0.01, perPixel: 0.02 },
  rx: { label: "x", step: 0.1, perPixel: 0.5 },
  ry: { label: "y", step: 0.1, perPixel: 0.5 },
  rz: { label: "z", step: 0.1, perPixel: 0.5 },
  fov: { label: "fov", step: 0.1, perPixel: 0.2, min: 1 },
  near: { label: "near", step: 0.01, perPixel: 0.005, min: 0.0001 },
  far: { label: "far", step: 1, perPixel: 0.5, min: 0.001 },
  zoom: { label: "zoom", step: 0.01, perPixel: 0.005, min: 0.01 },
};

/** Line icons on a 24 grid, stroked in the text colour (styles.ts). */
export const KIND_ICONS: Record<CameraKind, string> = {
  perspective: '<rect x="2" y="7" width="12" height="10" rx="2"/><path d="m14 10.5 7-4v11l-7-4"/>',
  orthographic: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18"/>',
  array:
    '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  cube: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  other: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};

const ICONS = {
  look: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  frustum: '<path d="M3 12 20 5v14Z"/><path d="M20 5v14"/><circle cx="3" cy="12" r="1"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  go: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  path: '<path d="M3 18c3-8 7-1 10-7s5-5 8-5"/><circle cx="3" cy="18" r="1.5"/><circle cx="21" cy="6" r="1.5"/>',
  remove: '<path d="M6 6l12 12M18 6 6 18"/>',
};

export const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

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

/** A camera's name as a JS identifier, for copied code: `orbit view` → `orbitView`. */
const identifier = (name: string) => {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word[0]!.toUpperCase() + word.slice(1),
    )
    .join("");

  return /^[A-Za-z_]/.test(joined) ? joined : `camera${joined}`;
};

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

  if (entry.keys > 0) {
    parts.push(`${entry.keys} key${entry.keys === 1 ? "" : "s"}`);
  } else if (entry.moving && entry.inScene) {
    parts.push("moving");
  }

  if (!entry.inScene) {
    parts.push("not in scene");
  }

  return parts.join(" · ");
};

/** Facts that aren't edited here, under the fields. */
const readoutOf = (entry: CameraEntry, details: CameraDetails) => {
  const { projection } = details;
  const rows: [string, string][] = [["world", triple(details.position)]];

  if (projection?.aspect !== undefined) {
    rows.push(["aspect", trim(projection.aspect, 3)]);
  }

  if (projection?.left !== undefined) {
    rows.push([
      "frustum",
      `l ${trim(projection.left)} r ${trim(projection.right!)} t ${trim(projection.top!)} b ${trim(projection.bottom!)}`,
    ]);
  }

  rows.push(["drawing", entry.live ? `${entry.fps} fps` : "no"]);
  rows.push([
    "in",
    entry.inScene ? entry.path.join(" › ") || "scene" : "the renderer only (not in the scene)",
  ]);

  return rows.map(([term, value]) => `<dt>${term}</dt><dd>${escape(value)}</dd>`).join("");
};

const numberField = (key: FieldKey) => {
  const { label, step, min } = FIELDS[key];

  return `<label class="tcm-num"><span class="tcm-scrub" data-scrub="${key}" title="Drag to change: Shift for fine, Alt for coarse">${label}</span><input type="number" data-field="${key}" step="${step}"${min === undefined ? "" : ` min="${min}"`} inputmode="decimal" /></label>`;
};

/** The values a field shows, from the camera now. */
const valuesOf = (details: CameraDetails): Partial<Record<FieldKey, number>> => {
  const [px, py, pz] = details.local.position;
  const [rx, ry, rz] = details.local.rotation;
  const projection = details.projection;

  return {
    px,
    py,
    pz,
    rx,
    ry,
    rz,
    ...(projection
      ? { near: projection.near, far: projection.far, zoom: projection.zoom, fov: projection.fov }
      : {}),
  };
};

const formatField = (key: FieldKey, value: number) =>
  trim(value, key.startsWith("r") || key === "fov" ? 2 : 4);

export const createCameraPanel = (
  lab: CameraLab,
  { paths = false }: CameraPanelOptions = {},
): CameraPanel => {
  injectStyles();

  const element = document.createElement("div");

  element.className = "tcm tcm-panel";
  element.innerHTML = `
    <div class="tcm-toolbar">
      <input type="search" class="tcm-search" placeholder="Filter by name…" autocomplete="off" spellcheck="false" aria-label="Filter cameras" />
      ${icon("refresh", "Look for new cameras")}
    </div>
    <div class="tcm-banner" hidden><span></span><button type="button" class="tcm-text-button" data-action="look-back">Back</button></div>
    <ul class="tcm-list"></ul>
    <div class="tcm-empty" hidden>No cameras yet. The one the renderer draws with shows up on its first frame.</div>
    <div class="tcm-status" role="status"></div>
  `;

  const search = element.querySelector<HTMLInputElement>(".tcm-search")!;
  const list = element.querySelector<HTMLUListElement>(".tcm-list")!;
  const empty = element.querySelector<HTMLElement>(".tcm-empty")!;
  const status = element.querySelector<HTMLElement>(".tcm-status")!;
  const banner = element.querySelector<HTMLElement>(".tcm-banner")!;
  const bannerText = banner.querySelector("span")!;
  const rows = new Map<string, Row>();
  const renderListeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  /** The field being scrubbed: the tick leaves it alone. */
  let scrubbing: HTMLInputElement | null = null;

  const say = (message: string) => {
    status.textContent = message;
  };

  const attempt = (work: () => void) => {
    try {
      say("");
      work();
    } catch (error) {
      say((error as Error).message.replace(/^three-cameras: /, ""));
    }
  };

  /** Read one field (or its x/y/z group) into a patch and set it. */
  const apply = (id: string, controls: Controls, key: FieldKey) => {
    const read = (field: FieldKey) => Number(controls.fields.get(field)?.value);
    const patch: CameraPatch = {};

    if (key.startsWith("p")) {
      const values = [read("px"), read("py"), read("pz")] as const;

      if (values.every(Number.isFinite)) {
        patch.position = values;
      }
    } else if (key.startsWith("r")) {
      const values = [read("rx"), read("ry"), read("rz")] as const;

      if (values.every(Number.isFinite)) {
        patch.rotation = values;
      }
    } else {
      const value = read(key);
      const min = FIELDS[key].min;

      if (Number.isFinite(value) && (min === undefined || value >= min)) {
        patch[key as "fov" | "near" | "far" | "zoom"] = value;
      }
    }

    attempt(() => lab.set(id, patch));
  };

  const buildControls = (row: Row, entry: CameraEntry): Controls => {
    const lens =
      entry.kind === "perspective"
        ? (["fov", "near", "far", "zoom"] as const)
        : entry.kind === "orthographic"
          ? (["zoom", "near", "far"] as const)
          : [];

    row.details.innerHTML = `
      <div class="tcm-group"><span class="tcm-term">position</span><div class="tcm-fields">${numberField("px")}${numberField("py")}${numberField("pz")}</div></div>
      <div class="tcm-group"><span class="tcm-term">rotation °</span><div class="tcm-fields">${numberField("rx")}${numberField("ry")}${numberField("rz")}</div></div>
      ${lens.length > 0 ? `<div class="tcm-group"><span class="tcm-term">lens</span><div class="tcm-fields tcm-fields--lens">${lens.map(numberField).join("")}</div></div>` : ""}
      <dl class="tcm-readout"></dl>
      ${
        entry.projects
          ? `<div class="tcm-buttons">
              <button type="button" class="tcm-text-button" data-action="copy" title="Copy three.js that sets this camera up as it is now">Copy as code</button>
              <button type="button" class="tcm-text-button" data-action="save" title="Save where it is and how it projects, to fly back to">Save view</button>
              <button type="button" class="tcm-text-button" data-action="bake" title="Turn where it's moved lately into keys on its track, to edit the path" hidden>Bake to keys</button>
            </div>
            <ul class="tcm-views" aria-label="Saved views"></ul>`
          : ""
      }
    `;

    const fields = new Map<FieldKey, HTMLInputElement>();

    for (const input of row.details.querySelectorAll<HTMLInputElement>("input[data-field]")) {
      fields.set(input.dataset.field as FieldKey, input);
    }

    const controls: Controls = {
      fields,
      readout: row.details.querySelector(".tcm-readout")!,
      views: row.details.querySelector(".tcm-views") ?? document.createElement("ul"),
      copy: row.details.querySelector('[data-action="copy"]') ?? document.createElement("button"),
      viewsDrawn: "",
    };
    const id = entry.id;

    for (const [key, input] of fields) {
      input.addEventListener("input", () => apply(id, controls, key));
      // Put the camera's real value back once the edit is done, e.g. after an invalid entry.
      input.addEventListener("blur", () => {
        const details = lab.details(id);
        const value = details ? valuesOf(details)[key] : undefined;

        if (value !== undefined) {
          input.value = formatField(key, value);
        }
      });
    }

    for (const handle of row.details.querySelectorAll<HTMLElement>("[data-scrub]")) {
      const key = handle.dataset.scrub as FieldKey;
      const input = fields.get(key)!;

      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        scrubbing = input;

        const startX = event.clientX;
        const startValue = Number(input.value) || 0;
        const { perPixel, min } = FIELDS[key];

        const onMove = (move: PointerEvent) => {
          const scale = move.shiftKey ? 0.1 : move.altKey ? 10 : 1;
          let value = startValue + (move.clientX - startX) * perPixel * scale;

          if (min !== undefined) {
            value = Math.max(min, value);
          }

          input.value = formatField(key, value);
          apply(id, controls, key);
        };
        const onUp = () => {
          scrubbing = null;
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          handle.removeEventListener("pointercancel", onUp);
        };

        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
      });
    }

    return controls;
  };

  const drawViews = (row: Row, entry: CameraEntry) => {
    const controls = row.controls!;
    const views = lab.views(entry.id);
    const drawn = views.map((view) => `${view.id}:${view.name}`).join("|");

    if (drawn === controls.viewsDrawn) {
      return;
    }

    controls.viewsDrawn = drawn;
    controls.views.innerHTML = views
      .map(
        (view) => `<li class="tcm-view" data-view="${escape(view.id)}">
          <button type="button" class="tcm-view-go" data-action="go" title="Fly back to ${escape(view.name)}">${svg(ICONS.go)}<span>${escape(view.name)}</span></button>
          ${icon("remove", `Forget ${escape(view.name)}`)}
        </li>`,
      )
      .join("");
  };

  const makeRow = (entry: CameraEntry): Row => {
    const li = document.createElement("li");
    const id = entry.id;

    li.className = "tcm-row";
    li.innerHTML = `
      <div class="tcm-head">
        <span class="tcm-kind" title="${entry.kind} camera">${svg(KIND_ICONS[entry.kind])}</span>
        <button type="button" class="tcm-text" data-action="open" aria-expanded="false" title="Pick to edit">
          <span class="tcm-name-line"><span class="tcm-name"></span><span class="tcm-badge"></span></span>
          <span class="tcm-meta"></span>
        </button>
        <div class="tcm-actions">
          ${paths ? icon("path", "Show its motion path in the scene") : ""}
          ${icon("look", "Look through it")}
          ${icon("frustum", "Show its frustum in the scene")}
          ${icon("chevron", "Edit", "tcm-chevron")}
        </div>
      </div>
      <div class="tcm-details"></div>
    `;

    const row: Row = {
      li,
      name: li.querySelector(".tcm-name")!,
      badge: li.querySelector(".tcm-badge")!,
      meta: li.querySelector(".tcm-meta")!,
      look: li.querySelector<HTMLButtonElement>('[data-action="look"]')!,
      helper: li.querySelector<HTMLButtonElement>('[data-action="frustum"]')!,
      path: li.querySelector<HTMLButtonElement>('[data-action="path"]'),
      details: li.querySelector(".tcm-details")!,
      controls: null,
      open: false,
    };

    row.name.textContent = id;
    row.name.title = id;
    li.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      const action = target?.dataset.action;
      const current = lab.entry(id);

      if (!current || !action) {
        return;
      }

      if (action === "open" || action === "chevron") {
        row.open = !row.open;

        if (row.open) {
          lab.select(id);
        }

        if (row.open && !row.controls) {
          row.controls = buildControls(row, current);
        }

        update(row, current);
      } else if (action === "look") {
        attempt(() => lab.lookThrough(current.viewing ? null : id));
      } else if (action === "path") {
        attempt(() => lab.setTrail(id, !current.trail));
      } else if (action === "frustum") {
        attempt(() => lab.setHelper(id, !current.helper));
      } else if (action === "copy") {
        void copyCode(row, current);
      } else if (action === "bake") {
        if (
          current.keys === 0 ||
          window.confirm(`Replace ${id}'s ${current.keys} keys with its recorded move?`)
        ) {
          attempt(() => {
            const keys = lab.bakeMotion(id);

            say(
              `Baked ${keys.length} keys from ${id}'s last few seconds: drag their dots in the scene.`,
            );
          });
        }
      } else if (action === "save") {
        attempt(() => lab.saveView(id));
      } else if (action === "go" || action === "remove") {
        const viewId = target.closest<HTMLElement>("[data-view]")?.dataset.view;

        if (viewId) {
          attempt(() => (action === "go" ? lab.goToView(id, viewId) : lab.deleteView(id, viewId)));
        }
      }
    });

    return row;
  };

  const copyCode = async (row: Row, entry: CameraEntry) => {
    const code = poseToCode(capturePose(entry.camera as never), identifier(entry.id));
    const button = row.controls!.copy;

    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
    } catch {
      say("The clipboard is blocked here. The code is logged to the console instead.");
      // oxlint-disable-next-line no-console -- the fallback when the clipboard is blocked
      console.log(code);
    }

    setTimeout(() => {
      button.textContent = "Copy as code";
    }, 1200);
  };

  const update = (row: Row, entry: CameraEntry) => {
    const open = row.open;
    const details = lab.details(entry.id);

    row.li.classList.toggle("is-live", entry.live);
    row.li.classList.toggle("is-open", open);
    row.li.classList.toggle("is-viewing", entry.viewing);
    row.li.classList.toggle("is-selected", entry.selected);
    row.badge.className = `tcm-badge${entry.viewing ? " is-viewing" : entry.live ? " is-live" : ""}`;
    row.badge.textContent = entry.viewing
      ? "viewing"
      : entry.standingIn
        ? "replaced"
        : entry.live
          ? `live · ${entry.fps} fps`
          : "";
    row.meta.textContent = describe(entry, details);
    row.meta.title = row.meta.textContent;
    row.look.disabled = !entry.projects || !lab.watching;
    row.look.setAttribute("aria-pressed", String(entry.viewing));
    row.look.title = entry.viewing ? "Stop looking through it" : "Look through it";
    row.look.setAttribute("aria-label", row.look.title);
    row.helper.disabled = !entry.canHelp;
    row.helper.setAttribute("aria-pressed", String(entry.helper));
    row.helper.title = entry.helper ? "Hide its frustum" : "Show its frustum in the scene";
    row.helper.setAttribute("aria-label", row.helper.title);

    if (row.path) {
      row.path.disabled = entry.keys === 0;
      row.path.setAttribute("aria-pressed", String(entry.trail));
      row.path.title = entry.trail ? "Hide its motion path" : "Show its motion path in the scene";
      row.path.setAttribute("aria-label", row.path.title);
    }

    for (const toggle of row.li.querySelectorAll('[data-action="open"], [data-action="chevron"]')) {
      toggle.setAttribute("aria-expanded", String(open));
    }

    if (!open || !details || !row.controls) {
      return;
    }

    const values = valuesOf(details);

    for (const [key, input] of row.controls.fields) {
      const value = values[key];

      // Leave a field alone while it's being typed in or scrubbed.
      if (value !== undefined && input !== document.activeElement && input !== scrubbing) {
        input.value = formatField(key, value);
      }
    }

    row.controls.readout.innerHTML = readoutOf(entry, details);

    const bake = row.details.querySelector<HTMLButtonElement>('[data-action="bake"]');

    if (bake) {
      bake.hidden = !entry.recorded;
    }
    drawViews(row, entry);
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

    const viewing = entries.find((entry) => entry.viewing);
    const standIn = entries.find((entry) => entry.standingIn);

    banner.hidden = !viewing;
    bannerText.textContent = viewing
      ? `Looking through ${viewing.id}${standIn ? ` in place of ${standIn.id}` : ""}`
      : "";
    empty.hidden = entries.length > 0;
    filter();
    element.dataset.count = String(entries.length);
    element.dispatchEvent(new CustomEvent("tcm-count", { detail: entries.length }));

    for (const listener of renderListeners) {
      listener();
    }
  };

  element.querySelector('[data-action="refresh"]')!.addEventListener("click", () => lab.refresh());
  banner
    .querySelector("button")!
    .addEventListener("click", () => attempt(() => lab.lookThrough(null)));
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
    row: (id) => rows.get(id)?.li ?? null,
    onRender: (listener) => {
      renderListeners.add(listener);

      return () => {
        renderListeners.delete(listener);
      };
    },
    dispose: () => {
      setActive(false);
      unsubscribe();
      renderListeners.clear();
      element.remove();
    },
  };
};
