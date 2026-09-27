/**
 * Instances refilled every frame: wheels on every car, projectiles, footprints. Each part (one
 * geometry and material) is an `InstancedMesh`; every frame, `begin()`, `push()` one matrix per
 * copy, `end()`. All parts share the matrices, so a wheel of three materials is three draws for
 * every wheel in the world. The pool grows when a frame pushes past its room.
 */
import {
  type BufferGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  type Material,
  type Matrix4,
} from "three";

export type PoolPart = { geometry: BufferGeometry; material: Material };

export type InstancePoolOptions = {
  name?: string;
  /** Starting room. Default 16; doubles as needed. */
  capacity?: number;
  /**
   * Recompute bounds every `end()` so the pool is frustum-culled as a whole. Off by default: a
   * pool spread over the scene is on screen anyway, and the bounds cost a pass over the copies.
   */
  cull?: boolean;
  /** Called on each `InstancedMesh` as it's made (and remade on growth): shadows, layers. */
  configure?: (mesh: InstancedMesh) => void;
};

export class InstancePool {
  /** Add this to the scene. */
  readonly group = new Group();
  private meshes: InstancedMesh[] = [];
  private count = 0;
  private readonly parts: readonly PoolPart[];
  private readonly options: InstancePoolOptions;

  constructor(parts: readonly PoolPart[], options: InstancePoolOptions = {}) {
    this.parts = parts;
    this.options = options;
    this.group.name = options.name ?? "instance-pool";
    this.build(options.capacity ?? 16);
  }

  /** How many copies the pool can take before it grows. */
  get capacity() {
    return this.meshes[0]?.instanceMatrix.count ?? 0;
  }

  /** Start a frame's copies. */
  begin() {
    this.count = 0;
  }

  /** Add one copy at `matrix` (in the group's frame). Returns its index this frame. */
  push(matrix: Matrix4) {
    if (this.count >= this.capacity) {
      this.build(this.capacity * 2);
    }

    for (const mesh of this.meshes) {
      mesh.setMatrixAt(this.count, matrix);
    }

    this.count += 1;

    return this.count - 1;
  }

  /** Finish the frame: draw exactly the copies pushed since `begin()`. */
  end() {
    for (const mesh of this.meshes) {
      mesh.count = this.count;
      mesh.instanceMatrix.needsUpdate = true;

      if (this.options.cull === true) {
        mesh.computeBoundingSphere();
      }
    }
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }

    this.meshes = [];
  }

  /** (Re)make the meshes with room for `capacity`, keeping the copies pushed so far. */
  private build(capacity: number) {
    const previous = this.meshes;

    this.meshes = this.parts.map(({ geometry, material }, part) => {
      const mesh = new InstancedMesh(geometry, material, capacity);
      const old = previous[part];

      mesh.name = `${this.group.name}:${material.name || part}`;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = this.options.cull === true;
      mesh.count = 0;

      if (old) {
        mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.count * 16));
      }

      this.options.configure?.(mesh);

      return mesh;
    });

    for (const old of previous) {
      old.removeFromParent();
      old.dispose();
    }

    this.group.add(...this.meshes);
  }
}
