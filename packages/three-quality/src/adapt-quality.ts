/**
 * The browser side: reads frame times (its own `requestAnimationFrame`, or the app's loop through
 * `update`), runs the controller, and applies its level: the renderer's pixel ratio, then the app's
 * tiers. Recomputes the ladder when the window resizes, and remembers the settled setting per
 * device. Touches `window` only inside `adaptQuality`, so the module imports on a server.
 */
import {
  type ControllerOptions,
  type ControllerState,
  createQualityController,
} from "./controller.ts";
import {
  buildLadder,
  type CeilingOptions,
  levelOf,
  pixelRatioCeiling,
  type Rung,
} from "./ladder.ts";
import {
  DEFAULT_STORAGE_KEY,
  loadQuality,
  type QualityStorage,
  saveQuality,
  type StoredQuality,
} from "./memory.ts";

/**
 * What `adaptQuality` needs of a renderer. Structural, so it takes three's `WebGLRenderer` and
 * `WebGPURenderer` alike (`tests/renderer-types.ts` pins both) without importing three.
 */
type QualityRenderer = {
  setPixelRatio: (value: number) => void;
  readonly domElement: { readonly clientWidth: number; readonly clientHeight: number };
};

/**
 * A setting the app can turn off when the pixel ratio alone isn't enough (shadows, bloom, how far
 * full-detail copies reach). `set(false)` turns it off, `set(true)` back on. A bare name works
 * too: read it from `state.tiers` (or `useQualityTier` in React).
 */
type QualityTier = {
  readonly name: string;
  readonly set?: (enabled: boolean) => void;
};

type AdaptQualityOptions = Omit<ControllerOptions, "levels" | "level"> &
  CeilingOptions & {
    /** The gap between pixel ratios. Default 0.25. */
    dprStep?: number;
    /** Turned off in this order once the pixel ratio bottoms out (`tiersFirst`: before it). */
    tiers?: readonly (string | QualityTier)[];
    /** Drop the tiers before the pixel ratio. Default false. */
    tiersFirst?: boolean;
    /**
     * `raf` (default) times frames with its own `requestAnimationFrame`; `manual` waits for
     * `update(frameMs)` from the app's loop (React Three Fiber's `useFrame` delta, say).
     */
    measure?: "raf" | "manual";
    /** localStorage key for the settled setting; `null` keeps nothing. Default `three-quality`. */
    storageKey?: string | null;
    /** Where it's kept. Default `localStorage`. */
    storage?: QualityStorage;
    /** Applies a pixel ratio. Default `renderer.setPixelRatio`; React Three Fiber's `setDpr`. */
    setDpr?: (dpr: number) => void;
    /** The canvas's CSS size. Default the renderer's canvas, else the window. */
    size?: () => { width: number; height: number };
    /** The display's ratio. Default `window.devicePixelRatio`. */
    devicePixelRatio?: () => number;
  };

type QualityState = ControllerState & {
  /** The pixel ratio applied. */
  readonly dpr: number;
  /** Each tier by name: `true` while on. */
  readonly tiers: Readonly<Record<string, boolean>>;
};

type AdaptiveQuality = {
  /** A new object on every change, so it can be compared by reference. */
  readonly state: QualityState;
  readonly level: number;
  readonly dpr: number;
  /** Called after each change of `state`. Returns the unsubscribe. */
  onChange: (listener: (state: QualityState) => void) => () => void;
  /** One frame's duration in ms, for `measure: "manual"`. */
  update: (frameMs: number) => void;
  /**
   * A player's choice: hold `level` (0 is the best, `state.levels - 1` the cheapest) and remember
   * it. `null` hands control back to the controller.
   */
  pin: (level: number | null) => void;
  /** Re-read the canvas size and display ratio. Window resizes do it already. */
  refresh: () => void;
  /** Stops measuring. Leaves the last setting applied. */
  dispose: () => void;
};

const normalizeTiers = (tiers: AdaptQualityOptions["tiers"] = []): QualityTier[] =>
  tiers.map((tier) => (typeof tier === "string" ? { name: tier } : tier));

const tierRecord = (tiers: readonly QualityTier[], off: number) =>
  Object.fromEntries(tiers.map((tier, index) => [tier.name, index >= off]));

/**
 * Adapts `renderer`'s pixel ratio (and the app's tiers) to what the device keeps up with. Starts
 * at the remembered setting, or the best, and measures from the next frame.
 */
const adaptQuality = (
  renderer: QualityRenderer | null,
  options: AdaptQualityOptions = {},
): AdaptiveQuality => {
  const tiers = normalizeTiers(options.tiers);
  const storageKey = options.storageKey === undefined ? DEFAULT_STORAGE_KEY : options.storageKey;
  const setDpr = options.setDpr ?? ((dpr: number) => renderer?.setPixelRatio(dpr));
  const hasWindow = typeof window !== "undefined";

  const readSize = () => {
    if (options.size) {
      return options.size();
    }

    const width = renderer?.domElement.clientWidth ?? 0;
    const height = renderer?.domElement.clientHeight ?? 0;

    if (width > 0 && height > 0) {
      return { width, height };
    }

    return hasWindow ? { width: window.innerWidth, height: window.innerHeight } : { width, height };
  };

  const readRatio = () =>
    options.devicePixelRatio?.() ?? (hasWindow ? window.devicePixelRatio || 1 : 1);

  const makeLadder = () => {
    const { width, height } = readSize();

    return buildLadder({
      ceiling: pixelRatioCeiling(width, height, readRatio(), options),
      dprStep: options.dprStep,
      minDpr: options.minDpr,
      tiers: tiers.length,
      tiersFirst: options.tiersFirst,
    });
  };

  let ladder = makeLadder();
  const stored = storageKey ? loadQuality(storageKey, options.storage) : null;
  const controller = createQualityController({
    ...options,
    level: stored ? levelOf(ladder, stored) : 0,
    levels: ladder.length,
  });

  if (stored?.pinned) {
    controller.pin(controller.state.level);
  }

  const listeners = new Set<(state: QualityState) => void>();
  let applied: Rung | null = null;
  let saved: StoredQuality | null = stored;
  let state!: QualityState;

  const rungAt = (level: number) => ladder[Math.min(level, ladder.length - 1)]!;

  const apply = () => {
    const rung = rungAt(controller.state.level);

    if (!applied || applied.dpr !== rung.dpr) {
      setDpr(rung.dpr);
    }

    tiers.forEach((tier, index) => {
      const was = !applied || index >= applied.tiersOff;
      const now = index >= rung.tiersOff;

      if (was !== now) {
        tier.set?.(now);
      }
    });

    applied = rung;
  };

  const publish = () => {
    const rung = rungAt(controller.state.level);
    state = { ...controller.state, dpr: rung.dpr, tiers: tierRecord(tiers, rung.tiersOff) };

    for (const listener of listeners) {
      listener(state);
    }
  };

  /** Keeps a setting once it's held: after a check passes, not mid-change. */
  const remember = () => {
    const { phase, level } = controller.state;

    if (!storageKey || phase === "warming" || phase === "adapting") {
      return;
    }

    const rung = rungAt(level);
    const next: StoredQuality = { ...rung, pinned: phase === "pinned" };

    if (
      saved?.dpr !== next.dpr ||
      saved.tiersOff !== next.tiersOff ||
      saved.pinned !== next.pinned
    ) {
      saved = next;
      saveQuality(storageKey, next, options.storage);
    }
  };

  apply();
  publish();

  let last = controller.state;

  const update = (frameMs: number) => {
    const changed = controller.add(frameMs);

    if (changed !== null) {
      apply();
    }

    if (controller.state !== last) {
      last = controller.state;
      remember();
      publish();
    }
  };

  const refresh = () => {
    const next = makeLadder();
    const same =
      next.length === ladder.length && next.every((rung, index) => rung.dpr === ladder[index]!.dpr);

    if (same) {
      return;
    }

    const current = rungAt(controller.state.level);
    ladder = next;
    const pinned = controller.state.phase === "pinned";
    controller.reset(ladder.length, levelOf(ladder, current));

    if (pinned) {
      controller.pin(controller.state.level);
    }

    last = controller.state;
    apply();
    publish();
  };

  let rafId: number | null = null;
  let lastAt: number | null = null;

  const tick = (now: number) => {
    rafId = requestAnimationFrame(tick);

    if (lastAt !== null) {
      update(now - lastAt);
    }

    lastAt = now;
  };

  if ((options.measure ?? "raf") === "raf" && typeof requestAnimationFrame === "function") {
    rafId = requestAnimationFrame(tick);
  }

  if (hasWindow) {
    window.addEventListener("resize", refresh);
  }

  return {
    get state() {
      return state;
    },
    get level() {
      return state.level;
    },
    get dpr() {
      return state.dpr;
    },
    onChange(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    update,
    pin(level) {
      controller.pin(level);
      last = controller.state;
      apply();

      if (level === null) {
        // Back to the controller: what it settles on is kept from here.
        if (storageKey) {
          saved = { ...rungAt(controller.state.level), pinned: false };
          saveQuality(storageKey, saved, options.storage);
        }
      } else {
        remember();
      }

      publish();
    },
    refresh,
    dispose() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (hasWindow) {
        window.removeEventListener("resize", refresh);
      }

      listeners.clear();
    },
  };
};

export { adaptQuality };
export type { AdaptiveQuality, AdaptQualityOptions, QualityRenderer, QualityState, QualityTier };
