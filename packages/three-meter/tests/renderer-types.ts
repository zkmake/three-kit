/**
 * Type-level pin: three's real renderers must satisfy the structural
 * `PerfRenderer` contract, or the cast in the R3F sampler is lying. Compiled
 * by `tsc`, never executed.
 */
import type { WebGLRenderer } from "three";
import type { WebGPURenderer } from "three/webgpu";

import type { PerfRenderer } from "../src/index.ts";

declare const webgl: WebGLRenderer;
declare const webgpu: WebGPURenderer;

export const webglIsPerfRenderer: PerfRenderer = webgl;
export const webgpuIsPerfRenderer: PerfRenderer = webgpu;
