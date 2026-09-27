/**
 * `@zkmake/three-audit`: checks for a three.js scene. What it costs (triangles, meshes,
 * geometries, draw calls) and what's wrong with it (z-fighting, NaN geometry, black frames).
 *
 * Zero runtime dependencies; objects are recognised by three's `is*` flags. The geometry checks
 * need no renderer, so they run in Node tests as well as the browser console.
 */

export { auditScene } from "./audit-scene.ts";
export type { AuditReport, AuditSceneOptions } from "./audit-scene.ts";
export { findBadGeometry } from "./bad-geometry.ts";
export type { BadGeometryOptions, BadGeometryRow } from "./bad-geometry.ts";
export { watchBlackFrames } from "./black-frames.ts";
export type { BlackFrameOptions, BlackFrameWatch, ProbeRenderer } from "./black-frames.ts";
export { installAuditHelpers } from "./console-helpers.ts";
export type { AuditHelpersOptions } from "./console-helpers.ts";
export { beginDrawLedger, ledgerTable, printDrawLedger, recordDrawLedger } from "./draw-ledger.ts";
export type {
  DrawLedger,
  DrawLedgerOptions,
  DrawLedgerRecording,
  LedgerRenderer,
  LedgerRow,
} from "./draw-ledger.ts";
export { triangleCount } from "./scene.ts";
export type { Skip } from "./scene.ts";
export { countTriangles, geometryCensus, listMeshes } from "./triangles.ts";
export type { GeometryRow, MeshRow, TriangleOptions } from "./triangles.ts";
export { findZFighting } from "./z-fighting.ts";
export type { ZFightingOptions, ZFightingRow } from "./z-fighting.ts";
