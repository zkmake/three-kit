import { defineConfig } from "tsdown";

/**
 * Library build: ESM entries with declarations — the page state, views and capture (`index`, DOM
 * only when called), the overlay and vanilla mount (`ui`), the React Three Fiber page (`react`),
 * the PNG tools and shot receiver for Node (`node`) and the `three-studio` bin (`cli`, its hashbang
 * kept). `exports` is generated into package.json on every build. Neutral platform: the browser
 * entries and the Node ones share one build. publint and arethetypeswrong run after each build.
 *
 * Not in tsconfig `include`, like three-meter's: tsdown types reach into `@arethetypeswrong/core`,
 * which ships `.ts` sources that fail this repo's strictness.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    ui: "src/ui/index.ts",
    react: "src/react/index.tsx",
    node: "src/node/index.ts",
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
  // The bin runs on import; it is `bin`, not an export.
  exports: { exclude: ["cli"] },
  publint: true,
  attw: { profile: "esm-only" },
});
