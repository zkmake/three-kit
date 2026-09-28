import { defineConfig } from "tsdown";

/**
 * Library build: three ESM entries with declarations — the swap engine (`index`, no DOM beyond
 * what a swap needs), the panel (`ui`) and the React Three Fiber component (`react`). `exports` is
 * generated into package.json on every build. publint and arethetypeswrong run after each build.
 *
 * Not in tsconfig `include`, like three-meter's: tsdown types reach into `@arethetypeswrong/core`,
 * which ships `.ts` sources that fail this repo's strictness.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    ui: "src/ui/index.ts",
    react: "src/react/index.tsx",
  },
  format: "esm",
  platform: "browser",
  target: "baseline-widely-available",
  dts: true,
  sourcemap: true,
  clean: true,
  exports: true,
  publint: true,
  attw: { profile: "esm-only" },
});
