import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The workspace links `@zkmake/three-meter`, but its exports point at `dist/`. Aliasing to the
// package's source instead means editing the library hot-reloads here with no build step.
// Mirrored in tsconfig `paths`.
const src = (path: string) =>
  decodeURIComponent(new URL(`../../packages/three-meter/src/${path}`, import.meta.url).pathname);

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@zkmake\/three-meter$/, replacement: src("index.ts") },
      { find: /^@zkmake\/three-meter\/(ui|react)$/, replacement: src("$1/index.ts") },
    ],
    // The package's source imports react, fiber and three too; one copy of each for the whole
    // page, or hooks and `instanceof` checks break across two copies.
    dedupe: ["react", "react-dom", "@react-three/fiber", "three"],
  },
  server: { port: 3021, strictPort: true },
  // three + react is ~1 MB minified; the warning would fire on every build.
  build: { chunkSizeWarningLimit: 1500 },
  preview: { port: 3021, strictPort: true },
  plugins: [react()],
});
