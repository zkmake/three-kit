/**
 * Type-level pins, compiled by `tsc`, never executed. The structural contracts must hold against
 * the real things, or "no dependency" is lying: three's renderers and scene, the panel packages'
 * `/ui` modules as the app imports them, three-audit's budgets file and three-quality's sources.
 */
import { defineBudgets } from "@zkmake/three-audit";
import { adaptQuality } from "@zkmake/three-quality";
import { qualityStore } from "@zkmake/three-quality/react";
import type { Scene, WebGLRenderer } from "three";
import type { WebGPURenderer } from "three/webgpu";

import type { DevPanels, MountDevToolsOptions } from "../src/index.ts";
import type { DevToolsProps } from "../src/react/index.ts";

declare const webgl: WebGLRenderer;
declare const webgpu: WebGPURenderer;
declare const scene: Scene;

const budgets = defineBudgets({ frame: { fps: 60, calls: 60, triangles: 150_000 } });

export const vanilla: MountDevToolsOptions = {
  budgets,
  quality: adaptQuality(webgl),
  renderer: webgl,
  scene,
};
export const onWebGpu: MountDevToolsOptions = { renderer: webgpu, scene };
export const panels: DevPanels = {
  cameras: () => import("@zkmake/three-cameras/ui"),
  textures: () => import("@zkmake/three-textures/ui"),
};
export const react: DevToolsProps = { budgets, panels, quality: qualityStore };
