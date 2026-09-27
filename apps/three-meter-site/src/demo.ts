/**
 * The contract both integrations meet so the shell can swap them in place.
 * Each factory mounts into `host`, owns its renderer and HUD, and tears
 * everything down in `dispose`.
 */
import type { Budgets, ThemeMode } from "@zkmake/three-meter/ui";

type DemoKind = "vanilla" | "r3f";

type DemoOptions = {
  /** Scene background, as a CSS hex colour. Follows the page theme. */
  background: string;
  /** Instances in the cube grid. */
  count: number;
  /** localStorage key shared by both integrations so the dock and selection carry over. */
  storageKey: string;
  /** The HUD's consumer theme layer. */
  theme: ThemeMode;
  /** `WebGPURenderer` instead of `WebGLRenderer`. */
  webgpu: boolean;
};

type Demo = {
  setBackground: (hex: string) => void;
  setTheme: (mode: ThemeMode) => void;
  dispose: () => void;
};

type DemoFactory = (host: HTMLElement, options: DemoOptions) => Promise<Demo>;

const DEMO_KINDS: readonly DemoKind[] = ["vanilla", "r3f"];

/**
 * A count budget on top of the timing defaults, so the demo shows one going
 * amber: 12 triangles a cube passes 250K a little past `?count=20000`.
 */
const HUD_BUDGETS: Budgets = { triangles: 250_000 };

const isDemoKind = (value: unknown): value is DemoKind =>
  typeof value === "string" && (DEMO_KINDS as readonly string[]).includes(value);

/** Same grid in both integrations: `count` cubes on a cube lattice, hue by index. */
const gridPosition = (index: number, count: number): [number, number, number] => {
  const side = Math.ceil(Math.cbrt(count));
  const x = (index % side) - side / 2;
  const y = (Math.floor(index / side) % side) - side / 2;
  const z = Math.floor(index / (side * side)) - side / 2;

  return [x * 0.7, y * 0.7, z * 0.7];
};

export { DEMO_KINDS, gridPosition, HUD_BUDGETS, isDemoKind };
export type { Demo, DemoFactory, DemoKind, DemoOptions };
