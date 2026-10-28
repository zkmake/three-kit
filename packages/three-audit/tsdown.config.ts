import { defineConfig } from "tsdown";

/**
 * Library build: ESM entries with declarations — the checks (`index`), the budgets file alone
 * (`budgets`: no imports, so an app's code can hold it without the checks), the Node model loader
 * (`node`), the Vitest matchers (`vitest`, which registers them on import: the one entry in
 * `sideEffects`) and the `three-audit` bin (`cli`, its hashbang kept); `exports` is generated into
 * package.json on every build so it can't drift from the entries. Neutral platform: the checks run in a browser
 * console and in Node (Vitest, CI) alike. publint and arethetypeswrong run after each build.
 *
 * Not in tsconfig `include`, like three-meter's: tsdown types reach into `@arethetypeswrong/core`,
 * which ships `.ts` sources that fail this repo's strictness.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    budgets: "src/define-budgets.ts",
    node: "src/node/index.ts",
    vitest: "src/vitest/index.ts",
    cli: "src/cli.ts",
  },
  // Node built-ins stay imports; the neutral platform doesn't know them.
  external: [/^node:/],
  format: "esm",
  platform: "neutral",
  target: "baseline-widely-available",
  dts: true,
  sourcemap: true,
  clean: true,
  // The bin runs on import; it is `bin`, not an export. `bin` is written by hand as npm stores it
  // (`dist/cli.js`): tsdown's generated `./dist/cli.js` makes npm warn on every publish.
  exports: { exclude: ["cli"], bin: false },
  publint: true,
  attw: { profile: "esm-only" },
});
