import { defineConfig } from "tsdown";

/**
 * Library build: ESM entries with declarations — the checks (`index`), the Node model loader
 * (`node`) and the `three-audit` bin (`cli`, its hashbang kept); `exports` is generated into package.json on
 * every build so it can't drift from the entries. Neutral platform: the checks run in a browser
 * console and in Node (Vitest, CI) alike. publint and arethetypeswrong run after each build.
 *
 * Not in tsconfig `include`, like three-meter's: tsdown types reach into `@arethetypeswrong/core`,
 * which ships `.ts` sources that fail this repo's strictness.
 */
export default defineConfig({
  entry: { index: "src/index.ts", node: "src/node/index.ts", cli: "src/cli.ts" },
  // Node built-ins stay imports; the neutral platform doesn't know them.
  external: [/^node:/],
  format: "esm",
  platform: "neutral",
  target: "baseline-widely-available",
  dts: true,
  sourcemap: true,
  clean: true,
  // The bin runs on import; it is `bin`, not an export.
  exports: { exclude: ["cli"] },
  publint: true,
  attw: { profile: "esm-only" },
});
