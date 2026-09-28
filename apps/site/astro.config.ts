import { satteri } from "@astrojs/markdown-satteri";
import react from "@vitejs/plugin-react";
import type { AstroIntegration } from "astro";
import { defineConfig } from "astro/config";

import { readmeLinks } from "./src/readme-links.ts";

// The workspace links the packages, but their exports point at `dist/`. Aliasing to source
// instead means editing a library hot-reloads here with no build step. Mirrored in tsconfig
// `paths`.
const src = (path: string) =>
  decodeURIComponent(new URL(`../../packages/${path}`, import.meta.url).pathname);

/**
 * The R3F demos mount their own React roots rather than Astro islands, so nothing installs Vite
 * React's fast-refresh preamble (plugin-react adds it through index.html, which Astro doesn't
 * have). In dev, every page gets it; the build needs none.
 */
const reactRefreshPreamble: AstroIntegration = {
  name: "react-refresh-preamble",
  hooks: {
    "astro:config:setup": ({ command, injectScript }) => {
      if (command === "dev") {
        injectScript("page", react.preambleCode.replace("__BASE__", "/"));
      }
    },
  },
};

export default defineConfig({
  integrations: [reactRefreshPreamble],
  site: "https://three-kit.pages.dev",
  // Pages serves `/three-meter/index.html` at `/three-meter/`; links and canonicals match.
  trailingSlash: "always",
  devToolbar: { enabled: false },
  server: { port: 3020 },
  markdown: {
    // Both palettes in the markup; site.css picks one by `data-theme`.
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
    processor: satteri({ mdastPlugins: [readmeLinks] }),
  },
  vite: {
    resolve: {
      alias: [
        { find: /^@zkmake\/three-textures$/, replacement: src("three-textures/src/index.ts") },
        {
          find: /^@zkmake\/three-textures\/ui$/,
          replacement: src("three-textures/src/ui/index.ts"),
        },
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
    // three + react is ~1 MB minified; the warning would fire on every build.
    build: { chunkSizeWarningLimit: 1500 },
    plugins: [react()],
  },
});
