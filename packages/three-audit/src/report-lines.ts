/**
 * The checks' rows as text lines, as the `three-audit` CLI prints them and the Vitest matchers
 * fail with.
 */
import type { BadGeometryRow, EmptyMeshRow } from "./bad-geometry.ts";
import type { BudgetCheck } from "./budgets.ts";
import type { ColorIssue } from "./color-issues.ts";
import type { FloatingRow, SunkRow } from "./grounding.ts";
import type { IntersectionRow } from "./intersections.ts";
import type { ShadowIssue } from "./shadow-issues.ts";
import type { TextureRow } from "./texture-memory.ts";
import type { TransparentRow } from "./transparent-overdraw.ts";
import type { MeshRow } from "./triangles.ts";
import type { UnnamedRow } from "./unnamed-meshes.ts";
import type { ZFightingRow } from "./z-fighting.ts";

export const count = (value: number) => value.toLocaleString("en-US");

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export const zFightingLines = (rows: readonly ZFightingRow[]) =>
  rows.flatMap((row) => {
    const more = row.planes.length > 1 ? ` (+${row.planes.length - 1} more)` : "";
    const copies = row.count > 1 ? `, ×${row.count} identical pairs` : "";

    return [
      `      ${row.a}`,
      `    ↔ ${row.b}`,
      `      ${row.triangles} triangles in ${row.planes[0]}${more}; overlap ${row.overlap.area} m² at (${row.overlap.centre.join(", ")})${copies}`,
    ];
  });

export const badGeometryLines = (rows: readonly BadGeometryRow[]) =>
  rows.map(
    (row) =>
      `      ${row.mesh}${row.under ? ` (${row.under})` : ""}: ${row.nonFinite} non-finite, ${row.zeroNormals} zero normals`,
  );

export const emptyMeshLines = (rows: readonly EmptyMeshRow[]) =>
  rows.map((row) => `      ${row.mesh}`);

export const meshLines = (rows: readonly MeshRow[]) =>
  rows.map(
    (row) =>
      `      ${count(row.total).padStart(9)}  ${row.name}${row.instances > 1 ? ` ×${row.instances}` : ""}`,
  );

/** `triangles  8,120 > 7,500 ✗`, one per limit, numbers lined up. */
export const budgetLines = (rows: readonly BudgetCheck[]) => {
  const actual = Math.max(...rows.map((row) => count(row.actual).length));

  return rows.map(
    (row) =>
      `      ${row.metric.padEnd(9)} ${count(row.actual).padStart(actual)} ${row.over ? ">" : "≤"} ${count(row.limit)}${row.over ? "  ✗" : ""}`,
  );
};

const copies = (n: number) => (n > 1 ? ` ×${n}` : "");

export const intersectionLines = (rows: readonly IntersectionRow[]) =>
  rows.flatMap((row) => [
    `      ${row.a}`,
    `    ✕ ${row.b}`,
    `      ${row.crossings} ${plural(row.crossings, "crossing")}, ${row.length} long, ${row.depth} deep at (${row.at.join(", ")})${copies(row.count)}`,
  ]);

export const floatingLines = (rows: readonly FloatingRow[]) =>
  rows.map(
    (row) =>
      `      ${row.mesh}: ${row.over === null ? (row.height === null ? "nothing under it" : `${row.height} up`) : `${row.clearance} over ${row.over}`} at (${row.at.join(", ")})${row.parts > 1 ? `, ${row.parts} parts together` : ""}${copies(row.count)}`,
  );

export const sunkLines = (rows: readonly SunkRow[]) =>
  rows.map(
    (row) =>
      `      ${row.mesh}: ${row.buried ? "buried" : `${Math.round(row.share * 100)}% under`}, ${row.depth} deep at (${row.at.join(", ")})${copies(row.count)}`,
  );

export const issueLines = (rows: readonly (ShadowIssue | ColorIssue)[]) =>
  rows.map((row) => `      ${row.subject}: ${row.detail}`);

export const unnamedLines = (rows: readonly UnnamedRow[]) =>
  rows.map((row) => `      ${count(row.triangles).padStart(9)}  ${row.mesh}${copies(row.count)}`);

const megabytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;

export const textureLines = (rows: readonly TextureRow[]) =>
  rows.map(
    (row) => `      ${megabytes(row.bytes).padStart(9)}  ${row.texture} ${row.size} ${row.format}`,
  );

export const transparentLines = (rows: readonly TransparentRow[]) =>
  rows.map(
    (row) =>
      `      ${count(row.triangles).padStart(9)}  ${row.mesh}${copies(row.instances)}${row.screens === null ? "" : `, ${row.screens} screens`}`,
  );
