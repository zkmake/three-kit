import { defineConfig } from "tsdown";

/**
 * Library build: one ESM entry with declarations; `exports` is generated into package.json on
 * every build so it can't drift from the entries. Neutral platform: the checks run in a browser
 * console and in Node (Vitest, CI) alike. publint and arethetypeswrong run after each build.
 *
 * Not in tsconfig `include`, like three-meter's: tsdown types reach into `@arethetypeswrong/core`,
 * which ships `.ts` sources that fail this repo's strictness.
 */
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  platform: "neutral",
  target: "baseline-widely-available",
  dts: true,
  sourcemap: true,
  clean: true,
  exports: true,
  publint: true,
  attw: { profile: "esm-only" },
});
