/**
 * A ledger of every draw call over one frame: which object drew, in which pass. Exact counts from
 * the renderer itself, where `renderer.info` gives one total (and resets it every `render()`).
 *
 * WebGL only: it wraps `WebGLRenderer.renderBufferDirect`, which every draw goes through, and
 * `render()`, to tell passes apart. Draws with a depth or distance material are the shadow maps.
 */
import type { Material, Object3D } from "three";

import { FRAME_TIMEOUT, nextFrame } from "./frames.ts";
import { patch } from "./patch.ts";
import { type AnyObject3D, pathOf } from "./scene.ts";

/**
 * The two `WebGLRenderer` methods the ledger wraps. Typed loosely, so a renderer from any copy of
 * three's types fits.
 */
export type LedgerRenderer = {
  render(scene: AnyObject3D, camera: object): void;
  renderBufferDirect(
    camera: object,
    scene: object | null,
    geometry: object,
    material: object,
    object: AnyObject3D,
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

export type RecordDrawLedgerOptions = DrawLedgerOptions & {
  /**
   * Record one call of this (the app's own render, sync or async) instead of one animation frame.
   * For a tab in the background, where no frames come.
   */
  render?: () => unknown;
  /** How long to wait for each animation frame before failing, in ms. Default 2000. */
  timeout?: number;
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

/** The object's name, or for an unnamed one its named ancestors, type and material. */
const nameOf = (object: Object3D, material: Material) =>
  object.name ||
  `${[...pathOf(object, null, undefined, 2), object.type].join("/")} [${material.name || material.type}]`;

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
    current = (scene as Partial<Object3D>).name || `render ${renders}`;

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
      const name = nameOf(object as unknown as Object3D, material as Material);

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
 *
 * With `render`, records one call of it instead, frames or not. Without, fails after `timeout`
 * when no frame comes (a background tab), rather than waiting for ever.
 */
export const recordDrawLedger = async (
  renderer: LedgerRenderer,
  options: RecordDrawLedgerOptions = {},
): Promise<DrawLedger> => {
  const { render, timeout = FRAME_TIMEOUT, ...ledgerOptions } = options;

  if (render) {
    const recording = beginDrawLedger(renderer, ledgerOptions);

    try {
      await render();
    } catch (error) {
      recording.end();
      throw error;
    }

    return recording.end();
  }

  const hint = "Bring the tab to the front, or pass { render } to record one call of your own.";

  await nextFrame("recordDrawLedger", timeout, hint);

  const recording = beginDrawLedger(renderer, ledgerOptions);

  try {
    await nextFrame("recordDrawLedger", timeout, hint);
  } catch (error) {
    recording.end();
    throw error;
  }

  return recording.end();
};

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
