/**
 * `mountDevTools`: everything an app's `?debug` wires, in one call. Nothing here imports the tools
 * themselves; each loads through `import()` only when it's on, so a normal load runs a URL check
 * and stops.
 */
import type { AnyObject3D, AuditHelpersOptions } from "@zkmake/three-audit";
import type { PerformanceMonitor, PerfRenderer } from "@zkmake/three-meter";
import type {
  BudgetsInput,
  MountPerfHudOptions,
  PerfHudHandle,
  QualitySource,
  ThemeMode,
} from "@zkmake/three-meter/ui";

/** What a panel package's `mount…Panel` is handed. */
type PanelMountOptions = {
  scene: unknown;
  renderer?: unknown;
  invalidate?: () => void;
  theme?: ThemeMode;
};

type PanelHandle = { dispose(): void };

/** `@zkmake/three-cameras/ui`, by shape: this package doesn't depend on it. */
type CamerasModule = { mountCameraPanel(options: PanelMountOptions): PanelHandle };

/** `@zkmake/three-textures/ui`, by shape. */
type TexturesModule = { mountTexturePanel(options: PanelMountOptions): PanelHandle };

/**
 * The panels to show behind the flag, each as the app's own `import()` of the panel package, so
 * only an app that installs a panel bundles it, and only behind the flag fetches it:
 * `{ cameras: () => import("@zkmake/three-cameras/ui") }`.
 */
type DevPanels = {
  cameras?: () => Promise<CamerasModule>;
  textures?: () => Promise<TexturesModule>;
};

/** The HUD's own options; `budgets` and `quality` are top-level. */
type DevHudOptions = Omit<MountPerfHudOptions, "budgets" | "quality" | "settings" | "theme">;

type MountDevToolsOptions = {
  /** The app's renderer: WebGL or WebGPU. */
  renderer: PerfRenderer;
  /** The app's scene: the console helpers and the panels read it. */
  scene: AnyObject3D;
  /** The URL query parameter that turns the tools on. Default `debug`. */
  flag?: string;
  /** On or off whatever the URL says: a settings toggle, a test. Default: the flag. */
  enabled?: boolean;
  /**
   * The console helpers without the flag, typically `import.meta.env.DEV`. The HUD and panels still
   * wait for the flag. Default false.
   */
  dev?: boolean;
  /** The app's budgets file (three-audit's `defineBudgets`), or the HUD's own budgets. */
  budgets?: BudgetsInput | false;
  /** Adaptive quality for the HUD: three-quality's `adaptQuality(…)` handle or `qualityStore`. */
  quality?: QualitySource;
  /** `dark`, `light` or `system` (default), for the HUD and the panels. */
  theme?: ThemeMode;
  /** The HUD's placement, storage key and mode; `false` for no HUD. */
  hud?: DevHudOptions | false;
  /** three-audit's console helpers' options; `false` for none. */
  audit?: Omit<AuditHelpersOptions, "renderer"> | false;
  /** Panels behind the flag. Default none. */
  panels?: DevPanels;
  /** Ask for a frame, for render-on-demand loops (R3F `frameloop="demand"`): the panels use it. */
  invalidate?: () => void;
};

type DevToolsHandle = {
  /** Whether the flag (or `enabled`) turned the tools on. */
  readonly enabled: boolean;
  /** Settles once every tool that's on has loaded and mounted (or failed, with a warning). */
  readonly ready: Promise<void>;
  /** The meter, once loaded; `null` without the flag. */
  readonly monitor: PerformanceMonitor | null;
  /** The HUD, once mounted. */
  readonly hud: PerfHudHandle | null;
  /**
   * A frame boundary, once a frame from your loop, before it renders: closes the previous frame
   * and opens the next. A no-op until the meter loads, and without the flag. Use this or `wrap`.
   */
  frame: () => void;
  /** `renderer.setAnimationLoop(tools.wrap(loop))`: each tick one frame for the meter. */
  wrap: <Args extends unknown[]>(loop: (...args: Args) => void) => (...args: Args) => void;
  setBudgets: (budgets: BudgetsInput | false | undefined) => void;
  setQuality: (quality: QualitySource | undefined) => void;
  /** Unmounts everything and removes the console helpers, including tools still loading. */
  dispose: () => void;
};

/** Whether the page's URL carries `?<flag>`. False outside a browser. */
const hasDebugFlag = (flag = "debug") =>
  typeof location !== "undefined" && new URLSearchParams(location.search).has(flag);

const warn = (what: string) => (error: unknown) => {
  // oxlint-disable-next-line no-console -- a tool that didn't load says so and leaves the rest
  console.warn(`three-devtools: ${what} failed to load`, error);
};

const mountDevTools = (options: MountDevToolsOptions): DevToolsHandle => {
  const { renderer, scene, invalidate, theme } = options;
  const enabled = options.enabled ?? hasDebugFlag(options.flag);
  const helpers = options.audit !== false && (enabled || options.dev === true);
  const cleanups: Array<() => void> = [];
  const tasks: Promise<void>[] = [];
  let disposed = false;
  let monitor: PerformanceMonitor | null = null;
  let hud: PerfHudHandle | null = null;
  let open = false;
  let budgets = options.budgets;
  let quality = options.quality;

  /** Runs `mount` once `load` resolves, unless disposed by then; keeps its cleanup. */
  const later = <T>(what: string, load: () => Promise<T>, mount: (loaded: T) => () => void) => {
    tasks.push(
      load().then((loaded) => {
        if (!disposed) {
          cleanups.push(mount(loaded));
        }
      }, warn(what)),
    );
  };

  if (helpers) {
    const audit = options.audit || {};

    later(
      "three-audit",
      () => import("@zkmake/three-audit"),
      ({ installAuditHelpers }) =>
        installAuditHelpers(scene, {
          ...audit,
          renderer: renderer as unknown as AuditHelpersOptions["renderer"],
        }),
    );
  }

  if (enabled && options.hud !== false) {
    const hudOptions = options.hud ?? {};

    later(
      "three-meter",
      () => import("./hud.ts"),
      ({ mountHud }) => {
        const mounted = mountHud(renderer, { ...hudOptions, budgets, quality, theme });

        monitor = mounted.monitor;
        hud = mounted.hud;
        open = false;

        return () => {
          monitor = null;
          hud = null;
          mounted.dispose();
        };
      },
    );
  }

  const panel = { invalidate, renderer, scene, theme };
  const { cameras, textures } = (enabled && options.panels) || {};

  if (cameras) {
    later("three-cameras", cameras, (ui) => {
      const mounted = ui.mountCameraPanel(panel);

      return () => mounted.dispose();
    });
  }

  if (textures) {
    later("three-textures", textures, (ui) => {
      const mounted = ui.mountTexturePanel(panel);

      return () => mounted.dispose();
    });
  }

  return {
    enabled,
    ready: Promise.all(tasks).then(() => undefined),
    get monitor() {
      return monitor;
    },
    get hud() {
      return hud;
    },
    frame: () => {
      if (!monitor) {
        return;
      }

      if (open) {
        monitor.end();
      }

      monitor.begin();
      open = true;
    },
    wrap:
      (loop) =>
      (...args) => {
        const current = monitor;

        if (!current) {
          loop(...args);
          return;
        }

        current.begin();

        try {
          loop(...args);
        } finally {
          current.end();
        }
      },
    setBudgets: (next) => {
      budgets = next;
      hud?.setBudgets(next);
    },
    setQuality: (next) => {
      quality = next;
      hud?.setQuality(next);
    },
    dispose: () => {
      disposed = true;

      for (const cleanup of cleanups.splice(0).reverse()) {
        cleanup();
      }
    },
  };
};

export { hasDebugFlag, mountDevTools };
export type {
  CamerasModule,
  DevHudOptions,
  DevPanels,
  DevToolsHandle,
  MountDevToolsOptions,
  PanelMountOptions,
  TexturesModule,
};
