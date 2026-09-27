import { defineConfig } from "tsdown";

import { PERF_HUD_STYLES } from "./src/ui/styles.ts";

/**
 * Library build. Three ESM entries with declarations; `exports` is generated
 * into package.json on every build so it can't drift from the entries. Every
 * condition points at `dist/`. No `devExports`: npm publishes `exports` as-is
 * and ignores `publishConfig.exports`, so a `development` condition aimed at
 * `src/` ships pointing at files the tarball doesn't carry (0.1.0 did exactly
 * that). The examples reach `src/` through a Vite alias instead. `styles.css`
 * is emitted from the same string the runtime injects, for hosts that would
 * rather link a file. publint and arethetypeswrong run after each build.
 *
 * Not in tsconfig `include`: tsdown types reach into `@arethetypeswrong/core`,
 * which ships `.ts` sources that fail this repo's strictness. tsdown validates
 * the config itself when it runs.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    ui: "src/ui/index.ts",
    react: "src/react/index.ts",
  },
  format: "esm",
  platform: "browser",
  target: "baseline-widely-available",
  dts: true,
  sourcemap: true,
  clean: true,
  exports: {
    customExports: {
      "./styles.css": "./dist/styles.css",
    },
  },
  publint: true,
  // A CSS export has no types to resolve; attw would flag it on every build.
  attw: { excludeEntrypoints: ["./styles.css"], profile: "esm-only" },
  plugins: [
    {
      name: "three-meter:emit-styles",
      generateBundle() {
        this.emitFile({
          fileName: "styles.css",
          source: `${PERF_HUD_STYLES.trim()}\n`,
          type: "asset",
        });
      },
    },
  ],
});
