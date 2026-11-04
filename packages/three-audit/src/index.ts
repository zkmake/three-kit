/**
 * `@zkmake/three-audit`: checks for a three.js scene. What it costs (triangles, meshes,
 * geometries, draw calls) and what's wrong with it (z-fighting, parts through or off each other, NaN geometry, shadows, colour,
 * black frames).
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
export { checkBudget, defineBudgets, parseBudgets } from "./budgets.ts";
export type {
  BudgetCheck,
  BudgetMetric,
  Budgets,
  BudgetsInput,
  FrameBudget,
  PartBudget,
} from "./budgets.ts";
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
export { countDraws, countTriangles, geometryCensus, listMeshes, triangles } from "./triangles.ts";
export type { CensusOptions, GeometryRow, MeshRow, TriangleOptions } from "./triangles.ts";
export { findColorIssues } from "./color-issues.ts";
export type { ColorIssue, ColorOptions, ColorProblem } from "./color-issues.ts";
export { findFloating, findSunk } from "./grounding.ts";
export type {
  FloatingOptions,
  FloatingRow,
  GroundOptions,
  SunkOptions,
  SunkRow,
} from "./grounding.ts";
export { findIntersections } from "./intersections.ts";
export type { IntersectionOptions, IntersectionRow } from "./intersections.ts";
export { findShadowIssues } from "./shadow-issues.ts";
export type { SetupRenderer, ShadowIssue, ShadowOptions, ShadowProblem } from "./shadow-issues.ts";
export { textureMemory } from "./texture-memory.ts";
export type { TextureMemory, TextureMemoryOptions, TextureRow } from "./texture-memory.ts";
export { transparentOverdraw } from "./transparent-overdraw.ts";
export type {
  TransparentOptions,
  TransparentOverdraw,
  TransparentRow,
} from "./transparent-overdraw.ts";
export { findUnnamedMeshes } from "./unnamed-meshes.ts";
export type { UnnamedOptions, UnnamedRow } from "./unnamed-meshes.ts";
export { findZFighting } from "./z-fighting.ts";
export type { ZFightingOptions, ZFightingRow } from "./z-fighting.ts";
