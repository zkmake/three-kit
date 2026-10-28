# @zkmake/three-studio

## 0.3.1

### Patch Changes

- Updated dependencies [[`706c4d6`](https://github.com/zkmake/three-kit/commit/706c4d6533edd90150704757e874c02b2f8a1b40)]:
  - @zkmake/three-audit@0.6.0

## 0.3.0

### Minor Changes

- [`080f8de`](https://github.com/zkmake/three-kit/commit/080f8de514b21ee19ba78a21afc13f488061b897) Thanks [@zkmake](https://github.com/zkmake)! - `<Studio Canvas={…}>` mounts the `<Canvas>` component it's given, so an app on React Three Fiber 10 whose game draws with WebGL passes the one from `@react-three/fiber/legacy` (10's default is WebGPU).

### Patch Changes

- Updated dependencies [[`2da80c1`](https://github.com/zkmake/three-kit/commit/2da80c1bbae6f99857f40af3363bd2a00b3ecde3)]:
  - @zkmake/three-audit@0.5.0

## 0.2.0

### Minor Changes

- [`06f038e`](https://github.com/zkmake/three-kit/commit/06f038eb26be6781b2f4b7c65ac48924738275b7) Thanks [@zkmake](https://github.com/zkmake)! - `?shots=<port>` points `saveShot` at a receiver on another port, and `serve` on a taken port says so; `orbitViews` takes `front` for objects that don't face +x.

### Patch Changes

- [`ae37944`](https://github.com/zkmake/three-kit/commit/ae37944548b22cb3e6bd4bb202bfdac239ee412b) Thanks [@zkmake](https://github.com/zkmake)! - The `bin` path is written `dist/cli.js`, as npm stores it, so publishing no longer warns that it corrected package.json. The command installs as before.
- Updated dependencies [[`e999256`](https://github.com/zkmake/three-kit/commit/e999256d9a08bfbde980e4518a2c0b5033b18660), [`ae37944`](https://github.com/zkmake/three-kit/commit/ae37944548b22cb3e6bd4bb202bfdac239ee412b)]:
  - @zkmake/three-audit@0.4.0

## 0.1.0

### Minor Changes

- [`ea570f1`](https://github.com/zkmake/three-kit/commit/ea570f145138fe16d97065cad40de95ea4516ad2) Thanks [@zkmake](https://github.com/zkmake)! - First release: mockup and model studio pages for three.js. Areas, variants and camera views from the URL (`resolveStudio`, `orbitViews`), an overlay with a draw-call readout, orbit controls, wireframe, frozen time and three-audit's console helpers (`mountStudio`, `<Studio>`, `<StudioRig>`), `saveShot(path)` for agents, and a `three-studio` CLI to receive shots and diff or montage them.
