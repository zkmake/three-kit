import { useFrame, useStore } from "@react-three/fiber";
import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  adaptQuality,
  type AdaptiveQuality as AdaptiveQualityHandle,
  type AdaptQualityOptions,
  type QualityState,
  type QualityTier,
} from "../adapt-quality.ts";
import { qualityStore, type QualityStore } from "./store.ts";

type AdaptiveQualityProps = Omit<AdaptQualityOptions, "measure" | "setDpr" | "size"> & {
  /** Must match the hooks'. Default: the shared store. */
  store?: QualityStore;
};

const tierName = (tier: string | QualityTier) => (typeof tier === "string" ? tier : tier.name);

/**
 * Adapts the `<Canvas>` it sits in: its pixel ratio through R3F's `setDpr`, timed from `useFrame`'s
 * delta, and the tiers named in `tiers` (read them with `useQualityTier`). Holds its ratio when R3F
 * puts the Canvas's own `dpr` prop back (a re-render of the Canvas, a display change).
 *
 * Options are compared by value, so inline literals are fine; a change remounts the controller.
 * A tier's `set` is read live. `storage` and `devicePixelRatio` are read at mount.
 */
function AdaptiveQuality({ store = qualityStore, tiers, ...options }: AdaptiveQualityProps) {
  const r3f = useStore();
  const handleRef = useRef<AdaptiveQualityHandle | null>(null);
  const tiersRef = useRef(tiers);
  const optionsRef = useRef(options);
  // By value: an inline `tiers={["shadows"]}` or `targetFps` literal is new every render.
  const optionsKey = JSON.stringify(options);
  const tierNames = (tiers ?? []).map(tierName).join("\n");

  useEffect(() => {
    tiersRef.current = tiers;
    optionsRef.current = options;
  });

  useEffect(() => {
    const names = tierNames ? tierNames.split("\n") : [];
    let wanted = 0;
    let size = r3f.getState().size;

    const handle = adaptQuality(r3f.getState().gl, {
      ...optionsRef.current,
      measure: "manual",
      setDpr: (dpr) => {
        wanted = dpr;
        r3f.getState().setDpr(dpr);
      },
      size: () => r3f.getState().size,
      tiers: names.map((name) => ({
        name,
        set: (enabled) => {
          const tier = tiersRef.current?.find((entry) => tierName(entry) === name);

          if (tier && typeof tier !== "string") {
            tier.set?.(enabled);
          }
        },
      })),
    });

    // R3F re-applies the Canvas's `dpr` prop on each Canvas render and display change: ours wins.
    const unsubscribe = r3f.subscribe((state) => {
      if (state.viewport.dpr !== wanted) {
        state.setDpr(wanted);
      }

      if (state.size !== size) {
        size = state.size;
        handle.refresh();
      }
    });

    handleRef.current = handle;
    store.set(handle);

    return () => {
      unsubscribe();
      handle.dispose();
      handleRef.current = null;

      if (store.get() === handle) {
        store.set(null);
      }
    };
  }, [optionsKey, r3f, store, tierNames]);

  useFrame((_, delta) => handleRef.current?.update(delta * 1000));

  return null;
}

/** The controller's state, or `null` until an `<AdaptiveQuality>` mounts. Works outside the Canvas. */
const useAdaptiveQuality = (store: QualityStore = qualityStore): QualityState | null =>
  useSyncExternalStore(
    store.subscribe,
    () => store.state,
    () => null,
  );

/** Whether tier `name` is on: `true` until the controller turns it off, and with no controller. */
const useQualityTier = (name: string, store: QualityStore = qualityStore): boolean =>
  useSyncExternalStore(
    store.subscribe,
    () => store.state?.tiers[name] ?? true,
    () => true,
  );

export { AdaptiveQuality, useAdaptiveQuality, useQualityTier };
export type { AdaptiveQualityProps };
