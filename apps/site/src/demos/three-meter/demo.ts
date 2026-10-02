/**
 * What both integrations share: their options and the cube grid. Each factory mounts into `host`,
 * owns its renderer and HUD, and tears everything down in `dispose`.
 */
import type { Budgets } from "@zkmake/three-meter/ui";

import type { Demo, DemoBase } from "../../scripts/demo-page.ts";
import type { Framing } from "../fit.ts";

type DemoOptions = DemoBase & {
  /** Instances in the cube grid. */
  count: number;
  /** localStorage key shared by both integrations so the dock and selection carry over. */
  storageKey: string;
  /** `WebGPURenderer` instead of `WebGLRenderer`. */
  webgpu: boolean;
};

type DemoFactory = (host: HTMLElement, options: DemoOptions) => Promise<Demo>;

/**
 * A count budget on top of the timing defaults, so the demo shows one going
 * amber: 12 triangles a cube passes 250K a little past `?count=20000`.
 */
const HUD_BUDGETS: Budgets = { triangles: 250_000 };

/** Same grid in both integrations: `count` cubes on a cube lattice, hue by index. */
const gridPosition = (index: number, count: number): [number, number, number] => {
  const side = Math.ceil(Math.cbrt(count));
  const x = (index % side) - side / 2;
  const y = (Math.floor(index / side) % side) - side / 2;
  const z = Math.floor(index / (side * side)) - side / 2;

  return [x * 0.7, y * 0.7, z * 0.7];
};

/** The camera on the lattice: the sphere around it (it turns) stays in view. */
const gridFraming = (count: number): Framing => ({
  position: [0, 6, 18],
  target: [0, 0, 0],
  radius: ((Math.ceil(Math.cbrt(count)) * 0.7) / 2) * Math.sqrt(3),
});

export { gridFraming, gridPosition, HUD_BUDGETS };
export type { DemoFactory, DemoOptions };
