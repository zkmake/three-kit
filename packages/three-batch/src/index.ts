/**
 * `@zkmake/three-batch`: fewer draw calls and fewer triangles for three.js scenes. Culling cells
 * for world-spanning meshes, static bakes, batches that follow moving objects, per-frame instance
 * pools, near/far switching, and `harmonize` to make mismatched geometries mergeable.
 *
 * Far copies (meshoptimizer) are `./lod`; React Three Fiber components are `./react`.
 */

export { bake, bakePiles, pileName } from "./bake.ts";
export type { BakedPile, BakeOptions, BakeResult } from "./bake.ts";
export { addGeometryWithRoom, addInstanceWithRoom, createBatch } from "./batch.ts";
export type { CreateBatchOptions } from "./batch.ts";
export { chunkGeometry, chunkInstances, chunkMesh, disposeChunks } from "./chunk.ts";
export type { ChunkOptions } from "./chunk.ts";
export { FollowBatch } from "./follow-batch.ts";
export type { FollowBatchOptions, FollowMember } from "./follow-batch.ts";
export { harmonize, weld } from "./harmonize.ts";
export type { HarmonizeOptions } from "./harmonize.ts";
export { InstancePool } from "./instance-pool.ts";
export type { InstancePoolOptions, PoolPart } from "./instance-pool.ts";
export { levelFor, pinLevel, pinnedLevel } from "./levels.ts";
export type { Level, LevelOptions } from "./levels.ts";
