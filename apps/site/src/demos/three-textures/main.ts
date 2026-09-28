/**
 * three-textures' demo page. Both integrations share storage keys, so the panels' docks and the
 * swaps carry across the switch.
 */
import { type Mount, startDemoPage } from "../../scripts/demo-page.ts";
import type { DemoFactory } from "./demo.ts";

const mount =
  (factory: DemoFactory): Mount =>
  (host, base) =>
    factory(host, { ...base, storageKey: "three-kit:three-textures" });

startDemoPage({
  load: {
    r3f: async () => mount((await import("./r3f.tsx")).createR3fDemo),
    vanilla: async () => mount((await import("./vanilla.ts")).createVanillaDemo),
  },
  usage: { r3f: "<TexturePanel />", vanilla: "mountTexturePanel({ scene, renderer })" },
  note: () => "live link needs Chrome or Edge",
});
