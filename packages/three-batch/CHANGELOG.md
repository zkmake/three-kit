# @zkmake/three-batch

## 0.1.3

### Patch Changes

- [`4359329`](https://github.com/zkmake/three-kit/commit/43593292b5757807f0ac7327e0d166f97150ee35) Thanks [@zkmake](https://github.com/zkmake)! - README: `disposeChunks`, the `"z"` axis, `bakePiles`, `skip` and bake names, `<Baked>`'s far copies as a `THREE.LOD` outside a batch and `FarCopiesContext`, `FollowBatch` without `lod` and its room options, `createBatch` / `addInstanceWithRoom`, `InstancePool`'s options, `/lod`'s wasm start, `minSaving` and `simplifyReport`'s tag, `pinLevel(null)` / `pinnedLevel`, and `harmonize`'s `indexed`.

## 0.1.2

### Patch Changes

- [`6b8fa7e`](https://github.com/zkmake/three-kit/commit/6b8fa7e3425760467a689167bb1d8e61dd0dac81) Thanks [@zkmake](https://github.com/zkmake)! - npm's homepage link now goes to the package's page on [zkmake.github.io/three-kit](https://zkmake.github.io/three-kit/) instead of its folder on GitHub.

## 0.1.1

### Patch Changes

- [`4e44e26`](https://github.com/zkmake/three-kit/commit/4e44e2670dd4341a7cfc9f1be405dee850c792ea) Thanks [@zkmake](https://github.com/zkmake)! - Fix: since 0.2.2, three-audit skipped hidden objects, which included the parts a three-batch bake
  hides, so z-fighting found nothing under a bake. three-audit now checks a bake's parts in place of
  its merge by default (`bakes: "sources"`; `"merged"` checks what's drawn) for z-fighting, NaN and
  empty geometry, `bbox` and `clearance`. three-batch flags the parts it hides with
  `userData.bakeSource`; bakes without the flag are recognised by their `bakedResult` merge.

## 0.1.0

### Minor Changes

- First release: culling cells, static bakes, batches that follow moving objects, instance pools, near/far switching, `harmonize`, meshoptimizer far copies (`./lod`) and React Three Fiber components (`./react`).
