/**
 * Type-level pin: three's real `WebGLRenderer` must satisfy the structural renderer contracts, or
 * `installAuditHelpers(scene, { renderer })` stops compiling for users. Compiled by `tsc`, never run.
 */
import type { WebGLRenderer } from "three";

import type { AuditHelpersOptions, LedgerRenderer, ProbeRenderer } from "../src/index.ts";

declare const webgl: WebGLRenderer;

export const ledger: LedgerRenderer = webgl;
export const probe: ProbeRenderer = webgl;
export const helpers: AuditHelpersOptions = { renderer: webgl };
