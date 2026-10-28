import { defineConfig } from "tsdown";

/**
 * Library build: two ESM entries with declarations; `exports` is generated into package.json on
 * every build so it can't drift from the entries. `./react` alone imports React and R3F, so the
 * core pulls in neither. Neutral platform: the controller runs in Node tests as well as the
 * browser. publint and arethetypeswrong run after each build.
 *
 * Not in tsconfig `include`, like three-meter's: tsdown types reach into `@arethetypeswrong/core`,
 * which ships `.ts` sources that fail this repo's strictness.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    react: "src/react/index.ts",
  },
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
