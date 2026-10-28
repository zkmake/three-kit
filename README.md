<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/cover-dark.png">
  <img alt="three-kit: dev tools and helpers for three.js" src="docs/cover-light.png">
</picture>

Tools and utilities for three.js, published separately under `@zkmake/*`. Each package has its own
version, changelog and README.

Site, with live demos and every README: [zkmake.github.io/three-kit](https://zkmake.github.io/three-kit/).
For coding agents, the same docs as markdown: [llms.txt](https://zkmake.github.io/three-kit/llms.txt) and
[llms-full.txt](https://zkmake.github.io/three-kit/llms-full.txt).

| Package                                                                                                                                   | What it is                                                                                                                          |                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| <img src="apps/site/public/three-meter/favicon.svg" width="20" height="20" alt=""> [**three&#8209;meter**](packages/three-meter)          | Frame metrics (FPS, CPU, GPU, stutter, draw calls) with a dockable HUD.                                                             | [demo](https://zkmake.github.io/three-kit/three-meter/demo/)    |
| <img src="apps/site/public/three-textures/favicon.svg" width="20" height="20" alt=""> [**three&#8209;textures**](packages/three-textures) | Dev panel for a scene's textures: download, paint, swap back in live (KTX2 too), A/B, live-link files.                              | [demo](https://zkmake.github.io/three-kit/three-textures/demo/) |
| <img src="apps/site/public/three-cameras/favicon.svg" width="20" height="20" alt=""> [**three&#8209;cameras**](packages/three-cameras)    | Dev panel for a scene's cameras: which are live, look through any one, edit it, keyframe moves and their paths.                     | [demo](https://zkmake.github.io/three-kit/three-cameras/demo/)  |
| <img src="apps/site/public/three-audit/favicon.svg" width="20" height="20" alt=""> [**three&#8209;audit**](packages/three-audit)          | Scene checks: z-fighting, NaN geometry, triangle budgets, draw-call ledgers, clearances. Runs in tests, the console and a glTF CLI. | [docs](https://zkmake.github.io/three-kit/three-audit/)         |
| <img src="apps/site/public/three-studio/favicon.svg" width="20" height="20" alt=""> [**three&#8209;studio**](packages/three-studio)       | Mockup and model studio pages: areas, variants and views from the URL, a draw-call readout, shots saved to disk and diffed.         | [docs](https://zkmake.github.io/three-kit/three-studio/)        |
| <img src="apps/site/public/three-batch/favicon.svg" width="20" height="20" alt=""> [**three&#8209;batch**](packages/three-batch)          | Fewer draws and triangles: culling cells, bakes, batches that follow moving objects, instance pools, far copies.                    | [docs](https://zkmake.github.io/three-kit/three-batch/)         |
| <img src="apps/site/public/three-quality/favicon.svg" width="20" height="20" alt=""> [**three&#8209;quality**](packages/three-quality)    | Render quality that adapts to the device at runtime: pixel ratio and the app's quality tiers, stepped from frame times.             | [docs](https://zkmake.github.io/three-kit/three-quality/)       |
| <img src="apps/site/public/three-devtools/favicon.svg" width="20" height="20" alt=""> [**three&#8209;devtools**](packages/three-devtools) | Every dev tool behind `?debug` in one drop-in: the HUD with the app's budgets, the console helpers, the panels. Lazy.               | [docs](https://zkmake.github.io/three-kit/three-devtools/)      |

All of them work with vanilla three and React Three Fiber.

## Agent skills

Skills that put the packages to work on your scene: `model-pass` remodels one object at a time
against your project's 3D style guide and budgets, `scene-mockups` builds variants of a part of
the scene to pick from, `perf-pass` fits the whole frame to the budgets, one area at a time, and
`kit-adopt` moves one app's copied debug, studio and budget code onto the packages in one pass.

In Claude Code, as a plugin; then `/three-kit:<skill>` (`/three-kit:perf-pass`):

```text
/plugin marketplace add zkmake/three-kit
/plugin install three-kit@three-kit
```

In any other agent (Codex, Cursor and others), through [skills.sh](https://skills.sh); then ask
for a skill by name:

```sh
npx skills add zkmake/three-kit
```

The skills install the packages into your project; see [plugins/three-kit](plugins/three-kit).

## Demos

<table>
  <tr>
    <td width="33%" valign="top">
      <a href="https://zkmake.github.io/three-kit/three-meter/demo/"><picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/demo-three-meter-dark.jpg">
        <img alt="three-meter's HUD beside a block of coloured cubes" src="docs/demo-three-meter-light.jpg">
      </picture></a>
      <b>three-meter</b>: what every frame costs, in a HUD you dock anywhere.
    </td>
    <td width="33%" valign="top">
      <a href="https://zkmake.github.io/three-kit/three-textures/demo/"><picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/demo-three-textures-dark.jpg">
        <img alt="three-textures' panel listing a crate, a noise texture and a KTX2 sticker atlas" src="docs/demo-three-textures-light.jpg">
      </picture></a>
      <b>three-textures</b>: paint any texture the scene draws and see it lit, with no rebuild.
    </td>
    <td width="33%" valign="top">
      <a href="https://zkmake.github.io/three-kit/three-cameras/demo/"><picture>
        <source media="(prefers-color-scheme: dark)" srcset="docs/demo-three-cameras-dark.jpg">
        <img alt="three-cameras' timeline, with a keyed camera's path drawn in the scene" src="docs/demo-three-cameras-light.jpg">
      </picture></a>
      <b>three-cameras</b>: every camera in the scene, a keyframe timeline, and paths you drag.
    </td>
  </tr>
</table>

## Layout

```
packages/<name>/   one published package each
apps/site/         zkmake.github.io/three-kit (Astro), built against the packages' source
plugins/three-kit/ the agent skills: a Claude Code plugin (.claude-plugin/marketplace.json) and skills.sh
configs/<name>/    shared config packages (TypeScript)
docs/              images the READMEs load
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to work on a package or add a new one.

## License

MIT
