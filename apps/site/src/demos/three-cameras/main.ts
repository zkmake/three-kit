/**
 * three-cameras' demo page. Both integrations share storage keys, so the panels' docks carry
 * across the switch.
 */
import { type Mount, startDemoPage } from "../../scripts/demo-page.ts";
import type { DemoFactory } from "./demo.ts";

const mount =
  (factory: DemoFactory): Mount =>
  (host, base) =>
    factory(host, { ...base, storageKey: "three-kit:three-cameras" });

startDemoPage({
  load: {
    r3f: async () => mount((await import("./r3f.tsx")).createR3fDemo),
    vanilla: async () => mount((await import("./vanilla.ts")).createVanillaDemo),
  },
  usage: { r3f: "<CameraPanel />", vanilla: "mountCameraPanel({ scene, renderer })" },
  note: () => "drag to orbit · the inset is the dolly camera",
});
