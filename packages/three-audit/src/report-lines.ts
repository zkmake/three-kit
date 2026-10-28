/**
 * The checks' rows as text lines, as the `three-audit` CLI prints them and the Vitest matchers
 * fail with.
 */
import type { BadGeometryRow, EmptyMeshRow } from "./bad-geometry.ts";
import type { BudgetCheck } from "./budgets.ts";
import type { MeshRow } from "./triangles.ts";
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
