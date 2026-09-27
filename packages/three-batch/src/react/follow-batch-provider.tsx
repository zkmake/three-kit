import type { ThreeElements } from "@react-three/fiber";
import { type ReactNode, useEffect, useState } from "react";

import { FollowBatch, type FollowBatchOptions } from "../follow-batch.ts";
import { type BakeTarget, BakeTargetContext } from "./baked.tsx";

export type FollowBatchProviderProps = FollowBatchOptions & {
  children?: ReactNode;
} & Omit<ThreeElements["group"], "children" | "name">;

/**
 * Every `<Baked>` under it draws through one `FollowBatch`: one draw per material for all of them,
 * each following its `<Baked>` group as it moves. The batch updates itself before each render; no
 * frame callback or priority to set.
 *
 * Options are read once, on mount.
 */
export function FollowBatchProvider({
  children,
  name,
  lod,
  instances,
  vertices,
  configure,
  ...group
}: FollowBatchProviderProps) {
  const [batch] = useState(
    () =>
      new FollowBatch({
        ...(name === undefined ? {} : { name }),
        ...(lod === undefined ? {} : { lod }),
        ...(instances === undefined ? {} : { instances }),
        ...(vertices === undefined ? {} : { vertices }),
        ...(configure === undefined ? {} : { configure }),
      }),
  );
  const [target] = useState<BakeTarget>(() => ({
    add: (object, pile) =>
      batch.add({
        object,
        geometry: pile.geometry,
        far: pile.far,
        material: pile.material,
        castShadow: pile.castShadow,
        receiveShadow: pile.receiveShadow,
      }),
  }));

  // Frees the batches; the FollowBatch makes new ones if StrictMode mounts again.
  useEffect(() => () => batch.dispose(), [batch]);

  return (
    <BakeTargetContext.Provider value={target}>
      <primitive object={batch.group} {...group} />
      {children}
    </BakeTargetContext.Provider>
  );
}
