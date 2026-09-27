import ReactThreeTestRenderer from "@react-three/test-renderer";
import { StrictMode } from "react";
import {
  type BatchedMesh,
  BoxGeometry,
  type Group,
  LOD,
  type Mesh,
  MeshStandardMaterial,
} from "three";
import { describe, expect, test } from "vitest";

import { pinLevel } from "../levels.ts";
import { Baked, FarCopiesContext, FollowBatchProvider } from "./index.ts";

// Tells React the renderer drives act() itself.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const wood = new MeshStandardMaterial({ name: "wood" });
const iron = new MeshStandardMaterial({ name: "iron" });
const box = new BoxGeometry(1, 1, 1, 4, 4, 4);
/** A stand-in simplifier: any smaller geometry will do. */
const farCopy = () => new BoxGeometry();

function Shed() {
  return (
    <>
      <mesh geometry={box} material={wood} castShadow={true} />
      <mesh geometry={box} material={wood} position={[2, 0, 0]} />
      <mesh geometry={box} material={iron} position={[4, 0, 0]} />
    </>
  );
}

const find = (scene: Group, name: string) => scene.getObjectByName(name);

describe("<Baked>", () => {
  test("merges its children per material, hides them, and restores them on unmount", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <Baked name="shed">
          <Shed />
        </Baked>
      </StrictMode>,
    );
    const scene = renderer.scene.instance as unknown as Group;
    const woodPile = find(scene, "shed:wood") as Mesh;

    // StrictMode bakes, undoes and bakes again: one set of merged meshes, not two.
    expect(scene.children[0]!.children.filter((child) => child.userData.bakedResult)).toHaveLength(
      2,
    );
    // Unindexed: one vertex per triangle corner.
    expect(woodPile.geometry.attributes.position!.count).toBe(2 * box.index!.count);
    expect(woodPile.castShadow).toBe(true);
    expect(scene.children[0]!.children.filter((child) => child.visible)).toHaveLength(2);

    const root = scene.children[0]!;

    await renderer.unmount();
    expect(root.children.filter((child) => child.userData.bakedResult)).toHaveLength(0);
  });

  test("a far copy becomes a LOD outside a batch, pinned when asked", async () => {
    pinLevel("far");

    const renderer = await ReactThreeTestRenderer.create(
      <Baked name="shed" far={farCopy} lod={{ distance: 40 }}>
        <Shed />
      </Baked>,
    );
    const lod = find(renderer.scene.instance as unknown as Group, "shed:wood") as LOD;

    pinLevel(null);
    expect(lod).toBeInstanceOf(LOD);
    expect(lod.levels.map((level) => level.distance)).toEqual([0, 40]);
    expect(lod.levels.map((level) => level.object.visible)).toEqual([false, true]);
    await renderer.unmount();
  });

  test("FarCopiesContext off skips far copies", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <FarCopiesContext.Provider value={false}>
        <Baked name="shed" far={farCopy}>
          <Shed />
        </Baked>
      </FarCopiesContext.Provider>,
    );

    expect(find(renderer.scene.instance as unknown as Group, "shed:wood")).not.toBeInstanceOf(LOD);
    await renderer.unmount();
  });
});

describe("<FollowBatchProvider>", () => {
  test("bakes under it go to one batch per material, and leave it on unmount", async () => {
    const Train = ({ cars }: { cars: number }) => (
      <FollowBatchProvider name="train" lod={{ distance: 30 }}>
        {Array.from({ length: cars }, (_, i) => (
          <Baked key={i} name={`car${i}`} position={[i * 6, 0, 0]} far={farCopy}>
            <Shed />
          </Baked>
        ))}
      </FollowBatchProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(
      <StrictMode>
        <Train cars={3} />
      </StrictMode>,
    );
    const scene = renderer.scene.instance as unknown as Group;
    const batches = (find(scene, "train") as Group).children as BatchedMesh[];

    expect(batches.map((batch) => [batch.name, batch.instanceCount])).toEqual([
      ["train:wood", 3],
      ["train:iron", 3],
    ]);
    // No merged meshes of their own: the batch draws them.
    expect(find(scene, "car0:wood")).toBeUndefined();

    await renderer.update(
      <StrictMode>
        <Train cars={1} />
      </StrictMode>,
    );
    expect(batches.map((batch) => batch.instanceCount)).toEqual([1, 1]);

    await renderer.unmount();
    expect((find(scene, "train") as Group | undefined)?.children.length ?? 0).toBe(0);
  });
});
