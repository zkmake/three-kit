/**
 * Type-level pins, compiled by `tsc`, never executed. three's real renderers must satisfy the
 * structural `QualityRenderer`, and the controller and the React store must satisfy three-meter's
 * structural `quality` reading, or either package's "no dependency" contract is lying.
 */
import type { QualitySource } from "@zkmake/three-meter/ui";
import type { WebGLRenderer } from "three";
import type { WebGPURenderer } from "three/webgpu";

import type { AdaptiveQuality, QualityRenderer } from "../src/index.ts";
import type { QualityStore } from "../src/react/index.ts";

declare const webgl: WebGLRenderer;
declare const webgpu: WebGPURenderer;
declare const handle: AdaptiveQuality;
declare const store: QualityStore;

export const webglIsQualityRenderer: QualityRenderer = webgl;
export const webgpuIsQualityRenderer: QualityRenderer = webgpu;
export const handleIsMeterSource: QualitySource = handle;
export const storeIsMeterSource: QualitySource = store;
