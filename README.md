# three-kit

Tools and utilities for three.js, published separately under `@zkmake/*`. Each package has its own
version, changelog and README.

| Package                                       | What it is                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`@zkmake/three-meter`](packages/three-meter) | Frame metrics (FPS, CPU, GPU, stutter, draw calls) with a dockable HUD. Vanilla three and R3F.         |
| [`@zkmake/three-audit`](packages/three-audit) | Scene checks: z-fighting, NaN geometry, triangle and draw-call ledgers. Runs in tests and the console. |

Live demo of three-meter: [three-meter.pages.dev](https://three-meter.pages.dev/).

## Layout

```
packages/<name>/   one published package each
apps/<name>/       demo apps, built against the packages' source
configs/<name>/    shared config packages (TypeScript)
docs/              images the package READMEs load
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to work on a package or add a new one.

## License

MIT
