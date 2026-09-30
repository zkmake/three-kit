import type { ThreeElements } from "@react-three/fiber";
import { createContext, type ReactNode, useContext, useLayoutEffect, useRef } from "react";
import { type BufferGeometry, type Group, LOD, Mesh, type Object3D } from "three";

import { type BakedPile, type BakeOptions, bakePiles, pileName } from "../bake.ts";
import { weld } from "../harmonize.ts";
import { type LevelOptions, pinnedLevel } from "../levels.ts";

/** A pile on its way to a batch: welded (indexed), with its far copy if the bake made one. */
export type TargetPile = BakedPile & { far: BufferGeometry | null };

/** Somewhere a bake's piles go instead of becoming meshes. `add` returns how to take one out. */
export type BakeTarget = { add: (object: Object3D, pile: TargetPile) => () => void };

/** A `<FollowBatchProvider>` (or your own batch) that `<Baked>` hands its piles to. */
export const BakeTargetContext = createContext<BakeTarget | null>(null);

/** Whether bakes under it make far copies. Off for a close-up render, e.g. a thumbnail. */
export const FarCopiesContext = createContext(true);

export type BakedProps = BakeOptions & {
  children?: ReactNode;
  /** Names the merged meshes: `<name>:<material>`. */
  name?: string;
  /** Make each pile's far copy from its welded geometry, e.g. `(g) => simplify(g, 0.02)`. */
  far?: (geometry: BufferGeometry) => BufferGeometry | null;
  /** When the far copy draws. Outside a batch it's a `THREE.LOD`; default 30 units out. */
  lod?: LevelOptions;
} & Omit<ThreeElements["group"], "children">;

/**
 * Bake the JSX under it into one mesh per material (`bakePiles`) on mount, and hide the parts.
 * The JSX stays the source of truth; the GPU sees a handful of draws. Under a `BakeTargetContext`
 * the piles go to that batch instead of becoming meshes here.
 *
 * Bakes once per mount: the parts are meant to be static. Remount it (change its `key`) to bake
 * again. Undone on unmount, so StrictMode and hot reload bake from the same JSX again.
 */
export function Baked({
  children,
  name = "baked",
  far,
  lod,
  keep,
  fold,
  skip,
  ...group
}: BakedProps) {
  const root = useRef<Group>(null);
  const target = useContext(BakeTargetContext);
  const farOn = useContext(FarCopiesContext) && far !== undefined;
  // The options are read once per bake, so they needn't be stable. Declared before the bake's
  // effect, so it runs first.
  const latest = useRef({ far, lod, keep, fold, skip });

  useLayoutEffect(() => {
    latest.current = { far, lod, keep, fold, skip };
  });

  useLayoutEffect(() => {
    const at = root.current;

    if (!at) {
      return;
    }

    const options = latest.current;
    const { piles, sources } = bakePiles(at, {
      ...(options.keep ? { keep: options.keep } : {}),
      ...(options.fold ? { fold: options.fold } : {}),
      ...(options.skip ? { skip: options.skip } : {}),
    });
    const added: Object3D[] = [];
    const releases: (() => void)[] = [];

    for (const pile of piles) {
      // Batches and far copies want indexed geometry.
      if (target || farOn) {
        const unwelded = pile.geometry;

        pile.geometry = weld(unwelded);
        unwelded.dispose();
      }

      const farCopy = farOn ? (options.far?.(pile.geometry) ?? null) : null;

      if (target) {
        releases.push(target.add(at, { ...pile, far: farCopy }));
        // The batch keeps its own copy.
        pile.geometry.dispose();
        farCopy?.dispose();
        continue;
      }

      const mesh = new Mesh(pile.geometry, pile.material);

      mesh.name = pileName(name, pile.material);
      mesh.castShadow = pile.castShadow;
      mesh.receiveShadow = pile.receiveShadow;
      mesh.userData.bakedResult = true;

      if (!farCopy) {
        added.push(mesh);
        continue;
      }

      const distant = mesh.clone();
      const levels = new LOD();
      const distance = options.lod?.distance ?? 30;
      const pin = pinnedLevel();

      distant.geometry = farCopy;
      distant.name = `${mesh.name}:far`;
      levels.name = mesh.name;
      levels.userData.bakedResult = true;
      levels.addLevel(mesh, 0);
      levels.addLevel(distant, distance, (options.lod?.hysteresis ?? 1.5) / distance);

      if (pin) {
        levels.autoUpdate = false;
        mesh.visible = pin === "near";
        distant.visible = pin === "far";
      }

      added.push(levels);
    }

    // Hide the parts only once every pile is built.
    for (const source of sources) {
      source.visible = false;
      source.userData.bakeSource = true;
    }

    if (added.length > 0) {
      at.add(...added);
    }

    return () => {
      for (const release of releases) {
        release();
      }

      for (const object of added) {
        object.removeFromParent();
        object.traverse((part) => (part as Mesh).geometry?.dispose());
      }

      for (const source of sources) {
        source.visible = true;
        delete source.userData.bakeSource;
      }
    };
  }, [name, target, farOn]);

  return (
    <group ref={root} {...group}>
      {children}
    </group>
  );
}
