import { defineConfig } from "vite";

// Source, not dist, for three-textures and the three-meter dock it uses: editing either library
// hot-reloads here with no build step. Mirrored in tsconfig `paths`.
const src = (path: string) =>
  decodeURIComponent(new URL(`../../packages/${path}`, import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@zkmake\/three-textures$/, replacement: src("three-textures/src/index.ts") },
      { find: /^@zkmake\/three-textures\/ui$/, replacement: src("three-textures/src/ui/index.ts") },
      { find: /^@zkmake\/three-meter$/, replacement: src("three-meter/src/index.ts") },
      { find: /^@zkmake\/three-meter\/ui$/, replacement: src("three-meter/src/ui/index.ts") },
    ],
    dedupe: ["three"],
  },
  server: { port: 3022, strictPort: true },
  build: { chunkSizeWarningLimit: 1500 },
  preview: { port: 3022, strictPort: true },
});
