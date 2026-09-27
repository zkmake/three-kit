/**
 * `BatchedMesh` helpers: build one from a set of geometries, and add to one that may be full.
 * A batch draws many geometries with one material in one draw call and culls each instance on
 * its own.
 */
import { BatchedMesh, type BufferGeometry, type Material } from "three";

export type CreateBatchOptions = {
  /** Instance room; grows on `addInstanceWithRoom`. Default: one per geometry. */
  instances?: number;
  name?: string;
};

const vertexCount = (geometry: BufferGeometry) => geometry.attributes.position?.count ?? 0;
const indexCount = (geometry: BufferGeometry) => geometry.index?.count ?? 0;

/**
 * A batch sized for exactly these geometries, each added once. Returns the batch and each
 * geometry's id, in order, for `addInstance`. The geometries must agree on attributes and
 * index-ness: `harmonize` them first if they may not.
 *
 * `frustumCulled` is off: the batch culls each instance itself, and its own bounding sphere would
 * go stale as instances move.
 */
export const createBatch = (
  geometries: readonly BufferGeometry[],
  material: Material,
  options: CreateBatchOptions = {},
) => {
  const vertices = geometries.reduce((sum, geometry) => sum + vertexCount(geometry), 0);
  const indices = geometries.reduce((sum, geometry) => sum + indexCount(geometry), 0);
  const mesh = new BatchedMesh(
    Math.max(1, options.instances ?? geometries.length),
    Math.max(1, vertices),
    Math.max(1, indices),
    material,
  );

  mesh.name = options.name ?? "";
  mesh.frustumCulled = false;

  return { mesh, ids: geometries.map((geometry) => mesh.addGeometry(geometry)) };
};

/** three keeps a batch's room to itself; these are its fields since r159. */
type Room = { _maxVertexCount: number; _maxIndexCount: number };

/**
 * `addGeometry`, making room first when the batch is full: repack it (`optimize`) to reclaim
 * deleted geometries' space, then grow it by doubling. Returns the geometry id.
 */
export const addGeometryWithRoom = (batch: BatchedMesh, geometry: BufferGeometry) => {
  const vertices = vertexCount(geometry);
  const indices = indexCount(geometry);
  const fits = () => batch.unusedVertexCount >= vertices && batch.unusedIndexCount >= indices;

  if (!fits()) {
    batch.optimize();
  }

  if (!fits()) {
    const room = batch as unknown as Room;
    const usedVertices = room._maxVertexCount - batch.unusedVertexCount;
    const usedIndices = room._maxIndexCount - batch.unusedIndexCount;
    let maxVertices = Math.max(1, room._maxVertexCount);
    let maxIndices = Math.max(1, room._maxIndexCount);

    while (maxVertices < usedVertices + vertices) {
      maxVertices *= 2;
    }

    while (maxIndices < usedIndices + indices) {
      maxIndices *= 2;
    }

    batch.setGeometrySize(maxVertices, maxIndices);
  }

  return batch.addGeometry(geometry);
};

/** `addInstance`, doubling the instance room first when it's full. Returns the instance id. */
export const addInstanceWithRoom = (batch: BatchedMesh, geometryId: number) => {
  if (batch.instanceCount >= batch.maxInstanceCount) {
    batch.setInstanceCount(Math.max(1, batch.maxInstanceCount * 2));
  }

  return batch.addInstance(geometryId);
};
