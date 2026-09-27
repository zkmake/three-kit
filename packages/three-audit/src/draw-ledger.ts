/**
 * A ledger of every draw call over one frame: which object drew, in which pass. Exact counts from
 * the renderer itself, where `renderer.info` gives one total (and resets it every `render()`).
 *
 * WebGL only: it wraps `WebGLRenderer.renderBufferDirect`, which every draw goes through, and
 * `render()`, to tell passes apart. Draws with a depth or distance material are the shadow maps.
 */
import type { BufferGeometry, Camera, Material, Object3D, Scene } from "three";

import { patch } from "./patch.ts";

/** The two `WebGLRenderer` methods the ledger wraps. */
export type LedgerRenderer = {
  render(scene: Object3D, camera: Camera): void;
  renderBufferDirect(
    camera: Camera,
    scene: Scene | null,
    geometry: BufferGeometry,
    material: Material,
    object: Object3D,
    group: unknown,
  ): void;
};

export type DrawLedgerOptions = {
  /**
   * The group an object name files under. Default: up to the first `:` or `#`, so a bake's
   * `wagon:paint` and a strip's `grass#3` group as `wagon` and `grass`.
   */
  groupOf?: (name: string) => string;
};

export type LedgerRow = {
  name: string;
  total: number;
  /** Draws per pass name. */
  passes: Record<string, number>;
};

export type DrawLedger = {
  /**
   * Pass names in the order they first drew: `shadow`, then each `render()` call as its scene's
   * name, or `render 1`, `render 2`… when unnamed (a post-processing chain is several).
   */
  passes: string[];
  /** By group, most draws first. */
  groups: LedgerRow[];
  /** By object name, most draws first. */
  objects: LedgerRow[];
  draws: number;
};

export type DrawLedgerRecording = {
  /** Restore the renderer and return what was drawn since `beginDrawLedger`. */
  end: () => DrawLedger;
};

const defaultGroupOf = (name: string) => name.split(/[:#]/)[0] || name;

const nameOf = (object: Object3D, material: Material) =>
  object.name || `${object.type}:${material.name || material.type}`;

const tally = (rows: Map<string, LedgerRow>, name: string, pass: string) => {
  const row = rows.get(name) ?? { name, total: 0, passes: {} };

  row.total += 1;
  row.passes[pass] = (row.passes[pass] ?? 0) + 1;
  rows.set(name, row);
};

const sorted = (rows: Map<string, LedgerRow>) =>
  [...rows.values()].sort((a, b) => b.total - a.total);

/** Start counting every draw. Call `end()` after the frame to restore the renderer and read it. */
export const beginDrawLedger = (
  renderer: LedgerRenderer,
  options: DrawLedgerOptions = {},
): DrawLedgerRecording => {
  if (typeof renderer.renderBufferDirect !== "function") {
    throw new TypeError("three-audit: the draw ledger needs a WebGLRenderer");
  }

  const groupOf = options.groupOf ?? defaultGroupOf;
  const render = renderer.render;
  const renderBufferDirect = renderer.renderBufferDirect;
  const passes: string[] = [];
  const objects = new Map<string, LedgerRow>();
  const groups = new Map<string, LedgerRow>();
  let renders = 0;
  let current = "direct";
  let draws = 0;

  const restoreRender = patch(renderer, "render", function (this: unknown, scene, camera) {
    const outer = current;

    renders += 1;
    current = scene.name || `render ${renders}`;

    try {
      render.call(this, scene, camera);
    } finally {
      current = outer;
    }
  });

  const restoreDraw = patch(
    renderer,
    "renderBufferDirect",
    function (this: unknown, camera, scene, geometry, material, object, group) {
      const shadow =
        (material as { isMeshDepthMaterial?: boolean }).isMeshDepthMaterial === true ||
        (material as { isMeshDistanceMaterial?: boolean }).isMeshDistanceMaterial === true;
      const pass = shadow ? "shadow" : current;
      const name = nameOf(object, material);

      if (!passes.includes(pass)) {
        passes.push(pass);
      }

      draws += 1;
      tally(objects, name, pass);
      tally(groups, groupOf(name), pass);
      renderBufferDirect.call(this, camera, scene, geometry, material, object, group);
    },
  );

  return {
    end: () => {
      restoreDraw();
      restoreRender();

      return { passes, groups: sorted(groups), objects: sorted(objects), draws };
    },
  };
};

/**
 * Record exactly one frame of an app that renders from `requestAnimationFrame` (three's
 * `setAnimationLoop`, React Three Fiber): from one animation frame to the next. A demand-driven
 * loop that renders nothing that frame gives an empty ledger. Browser only.
 */
export const recordDrawLedger = (renderer: LedgerRenderer, options: DrawLedgerOptions = {}) =>
  new Promise<DrawLedger>((resolve, reject) => {
    if (typeof requestAnimationFrame !== "function") {
      reject(new Error("three-audit: recordDrawLedger needs requestAnimationFrame"));

      return;
    }

    requestAnimationFrame(() => {
      try {
        const recording = beginDrawLedger(renderer, options);

        requestAnimationFrame(() => resolve(recording.end()));
      } catch (error) {
        reject(error);
      }
    });
  });

/** Rows shaped for `console.table`: one column per pass, then the total. */
export const ledgerTable = (rows: LedgerRow[], passes: string[]) =>
  rows.map((row) => ({
    name: row.name,
    ...Object.fromEntries(passes.map((pass) => [pass, row.passes[pass] ?? 0])),
    total: row.total,
  }));

/** The ledger as two console tables: by group, and every object collapsed beneath. */
export const printDrawLedger = (ledger: DrawLedger) => {
  /* oxlint-disable no-console -- printing is this function's job */
  console.group(`Draw ledger: ${ledger.draws} draws in one frame`);
  console.table(ledgerTable(ledger.groups, ledger.passes));
  console.groupCollapsed("Every object");
  console.table(ledgerTable(ledger.objects, ledger.passes));
  console.groupEnd();
  console.groupEnd();
  /* oxlint-enable no-console */
};
