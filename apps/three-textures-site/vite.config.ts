import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The workspace links the packages, but their exports point at `dist/`. Aliasing to source
// instead means editing either library hot-reloads here with no build step. Mirrored in tsconfig
// `paths`.
const src = (path: string) =>
  decodeURIComponent(new URL(`../../packages/${path}`, import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@zkmake\/three-textures$/, replacement: src("three-textures/src/index.ts") },
      { find: /^@zkmake\/three-textures\/ui$/, replacement: src("three-textures/src/ui/index.ts") },
      {
        find: /^@zkmake\/three-textures\/react$/,
        replacement: src("three-textures/src/react/index.tsx"),
      },
      { find: /^@zkmake\/three-meter$/, replacement: src("three-meter/src/index.ts") },
      {
        find: /^@zkmake\/three-meter\/(ui|react)$/,
        replacement: src("three-meter/src/$1/index.ts"),
      },
    ],
    // The packages' source imports react, fiber and three too: one copy of each for the page.
    dedupe: ["react", "react-dom", "@react-three/fiber", "three"],
  },
  server: { port: 3022, strictPort: true },
  // three + react is ~1 MB minified; the warning would fire on every build.
  build: { chunkSizeWarningLimit: 1500 },
  preview: { port: 3022, strictPort: true },
  plugins: [react()],
});
