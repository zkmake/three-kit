/**
 * Type-level pin: three's real renderers must satisfy the structural renderer contracts, or
 * `installAuditHelpers(scene, { renderer })` stops compiling for users. Compiled by `tsc`, never run.
 */
import type { WebGLRenderer } from "three";
import type { WebGPURenderer } from "three/webgpu";

import type { AuditHelpersOptions, LedgerRenderer, ProbeRenderer } from "../src/index.ts";

declare const webgl: WebGLRenderer;

declare const webgpu: WebGPURenderer;

export const ledger: LedgerRenderer = webgl;
export const ledgerWebGPU: LedgerRenderer = webgpu;
export const probe: ProbeRenderer = webgl;
export const helpers: AuditHelpersOptions = { renderer: webgl };
export const helpersWebGPU: AuditHelpersOptions = { renderer: webgpu };
