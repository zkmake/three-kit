/**
 * `@zkmake/three-audit`: checks for a three.js scene. What it costs (triangles, meshes,
 * geometries, draw calls) and what's wrong with it (z-fighting, NaN geometry, black frames).
 *
 * Zero runtime dependencies; objects are recognised by three's `is*` flags. The geometry checks
 * need no renderer, so they run in Node tests as well as the browser console.
 */

export { auditScene, summarizeScene } from "./audit-scene.ts";
export type {
  AuditReport,
  AuditSceneOptions,
  AuditSummary,
  AuditSummaryOptions,
} from "./audit-scene.ts";
export { findBadGeometry, findEmptyMeshes } from "./bad-geometry.ts";
export type { BadGeometryOptions, BadGeometryRow, EmptyMeshRow } from "./bad-geometry.ts";
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
  PassRow,
  RecordDrawLedgerOptions,
} from "./draw-ledger.ts";
export { measureBounds, measureClearance } from "./measure.ts";
export type { Bounds, Clearance, MeasureOptions, Target } from "./measure.ts";
export { triangleCount } from "./scene.ts";
export type { AnyObject3D, Bakes, Skip } from "./scene.ts";
export { countDraws, countTriangles, geometryCensus, listMeshes } from "./triangles.ts";
export type { CensusOptions, GeometryRow, MeshRow, TriangleOptions } from "./triangles.ts";
export { findZFighting } from "./z-fighting.ts";
export type { ZFightingOptions, ZFightingRow } from "./z-fighting.ts";
