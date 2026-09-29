/**
 * A ledger of every draw call over one frame: which object drew, in which pass. Exact counts from
 * the renderer itself, where `renderer.info` gives one total (and resets it every `render()`).
 *
 * WebGL only: it wraps `WebGLRenderer.renderBufferDirect`, which every draw goes through, and
 * `render()`, to tell passes apart. Draws with a depth or distance material are the shadow maps.
 */
import type { BufferGeometry, Material, Mesh, Object3D } from "three";

import { FRAME_TIMEOUT, nextFrame } from "./frames.ts";
import { patch } from "./patch.ts";
import {
  type AnyObject3D,
  batchedTriangles,
  isBatched,
  isInstanced,
  pathOf,
  triangleCount,
} from "./scene.ts";

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
  /** For pass sizes: the target being drawn to, `null` for the screen. */
  getRenderTarget?(): unknown;
  /** For pass sizes: the screen's drawing buffer, device pixels. */
  getContext?(): unknown;
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

export type PassRow = {
  name: string;
  draws: number;
  /** Distinct objects drawn: for `shadow`, the casters. */
  objects: number;
  /** Triangles drawn, instances counted. */
  triangles: number;
  /** Sizes drawn to, in device pixels: `2880×1800`, or `screen 2880×1800`. */
  targets: string[];
  /** Every call was one small mesh through an orthographic camera: a post-processing pass. */
  fullscreen: boolean;
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
  /** Each pass's draws, triangles, casters and target sizes, in `passes` order. */
  passStats: PassRow[];
  /** `render()` calls that drew one fullscreen pass, and the pixels they shaded between them. */
  fullscreenPasses: number;
  fullscreenPixels: number;
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

/** Triangles one draw makes: its material group's range, times its instances. */
const drawTriangles = (geometry: BufferGeometry, object: Object3D, group: unknown) => {
  const mesh = object as Mesh;

  if (mesh.isMesh !== true) {
    return 0;
  }

  if (isBatched(mesh)) {
    return batchedTriangles(mesh).triangles;
  }

  const range = group as { start?: number; count?: number } | null;
  const elements = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
  const own =
    range && typeof range.count === "number"
      ? Math.floor(Math.max(0, Math.min(range.count, elements - (range.start ?? 0))) / 3)
      : triangleCount(geometry);

  return own * (isInstanced(mesh) ? mesh.count : 1);
};

type Size = { width: number; height: number; screen: boolean };

type PassTally = Omit<PassRow, "objects" | "targets" | "fullscreen"> & {
  objects: Set<Object3D>;
  targets: Set<string>;
  calls: number;
  fullscreenCalls: number;
};

type Call = {
  pass: string;
  draws: number;
  orthographic: boolean;
  /** Vertices of the one draw so far. */
  vertices: number;
  size: Size | null;
};

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
  const stats = new Map<string, PassTally>();
  const calls: Call[] = [];
  let renders = 0;
  let current = "direct";
  let draws = 0;
  let fullscreenPasses = 0;
  let fullscreenPixels = 0;

  const statOf = (pass: string) => {
    let stat = stats.get(pass);

    if (!stat) {
      stat = {
        name: pass,
        draws: 0,
        triangles: 0,
        objects: new Set(),
        targets: new Set(),
        calls: 0,
        fullscreenCalls: 0,
      };
      stats.set(pass, stat);
    }

    return stat;
  };

  const sizeNow = (): Size | null => {
    const target = renderer.getRenderTarget?.() as { width?: number; height?: number } | null;

    if (target && typeof target.width === "number" && typeof target.height === "number") {
      return { width: target.width, height: target.height, screen: false };
    }

    const gl = renderer.getContext?.() as
      | { drawingBufferWidth?: number; drawingBufferHeight?: number }
      | null
      | undefined;

    return target === null && typeof gl?.drawingBufferWidth === "number"
      ? { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight ?? 0, screen: true }
      : null;
  };

  const restoreRender = patch(renderer, "render", function (this: unknown, scene, camera) {
    const outer = current;

    renders += 1;
    current = (scene as Partial<Object3D>).name || `render ${renders}`;

    const call: Call = {
      pass: current,
      draws: 0,
      orthographic: (camera as { isOrthographicCamera?: boolean }).isOrthographicCamera === true,
      vertices: 0,
      size: null,
    };

    calls.push(call);

    try {
      render.call(this, scene, camera);
    } finally {
      calls.pop();
      current = outer;

      const stat = stats.get(call.pass);

      if (stat) {
        stat.calls += 1;

        // One small mesh through an orthographic camera: a fullscreen quad or triangle.
        if (call.draws === 1 && call.orthographic && call.vertices <= 6) {
          stat.fullscreenCalls += 1;
          fullscreenPasses += 1;
          fullscreenPixels += call.size ? call.size.width * call.size.height : 0;
        }
      }
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

      const stat = statOf(pass);
      const size = sizeNow();
      const drawn = geometry as BufferGeometry;

      stat.draws += 1;
      stat.triangles += drawTriangles(drawn, object as unknown as Object3D, group);
      stat.objects.add(object as unknown as Object3D);

      if (size) {
        stat.targets.add(`${size.screen ? "screen " : ""}${size.width}×${size.height}`);
      }

      const call = calls.at(-1);

      if (call && !shadow) {
        call.draws += 1;
        call.vertices = drawn.attributes?.position?.count ?? Infinity;
        call.size = size;
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

      return {
        passes,
        groups: sorted(groups),
        objects: sorted(objects),
        draws,
        passStats: passes.map((pass) => {
          const stat = stats.get(pass)!;

          return {
            name: pass,
            draws: stat.draws,
            objects: stat.objects.size,
            triangles: stat.triangles,
            targets: [...stat.targets],
            fullscreen: stat.calls > 0 && stat.fullscreenCalls === stat.calls,
          };
        }),
        fullscreenPasses,
        fullscreenPixels,
      };
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
  console.table(ledger.passStats.map((pass) => ({ ...pass, targets: pass.targets.join(", ") })));

  if (ledger.fullscreenPasses > 0) {
    console.log(
      `${ledger.fullscreenPasses} fullscreen passes: ${(ledger.fullscreenPixels / 1e6).toFixed(1)} Mpx shaded`,
    );
  }

  console.groupCollapsed("Every object");
  console.table(ledgerTable(ledger.objects, ledger.passes));
  console.groupEnd();
  console.groupEnd();
  /* oxlint-enable no-console */
};
