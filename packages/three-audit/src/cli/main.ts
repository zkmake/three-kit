/**
 * `three-audit model.glb [more.gltf …]`: load each model in Node and check it for z-fighting and
 * NaN geometry. Exits 1 when a check fails, so it can gate CI; `--json` for machines.
 */
/* oxlint-disable no-console -- a CLI's output is the console */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";

import { type AuditReport, auditScene } from "../audit-scene.ts";
import { loadModel } from "../node/load.ts";

const HELP = `Usage: three-audit <model.glb|model.gltf>… [options]

Checks glTF models for z-fighting (faces in one plane, facing the same way, overlapping) and
geometry that renders NaN (non-finite positions or normals, zero-length normals). Exits 1 when
any model fails a check, 2 when a model can't be read.

Options:
  --gap <m>       How close two planes count as one, in metres (default 0.004)
  --self          Also check for z-fighting within each mesh (merged geometry)
  --skip <regex>  Leave out objects whose name matches, and everything under them (decals)
  --top <n>       List the n costliest meshes (default 5, 0 for none)
  --json          Print the reports as JSON
  --no-fail       Exit 0 even when a check fails
  -h, --help      Show this help
  -v, --version   Show the version

Draco and Meshopt models need draco3dgltf / meshoptimizer installed alongside.`;

/** This package's version: its package.json is the nearest one up from here (`src/cli` or `dist`). */
const version = () => {
  for (let up = "../"; up.length <= 12; up += "../") {
    try {
      const pkg = JSON.parse(
        readFileSync(new URL(`${up}package.json`, import.meta.url), "utf8"),
      ) as {
        name?: string;
        version: string;
      };

      if (pkg.name === "@zkmake/three-audit") {
        return pkg.version;
      }
    } catch {
      // Not here; one more up.
    }
  }

  return "unknown";
};

const count = (value: number) => value.toLocaleString("en-US");

const printReport = (file: string, report: AuditReport, top: number) => {
  const lines = [`${basename(file)}  ${count(report.triangles)} triangles`];

  if (report.zFighting.length === 0) {
    lines.push("  ✓ no z-fighting");
  } else {
    lines.push(
      `  ✗ ${report.zFighting.length} z-fighting pair${report.zFighting.length === 1 ? "" : "s"}`,
    );

    for (const row of report.zFighting) {
      const more = row.planes.length > 1 ? ` (+${row.planes.length - 1} more)` : "";
      const copies = row.count > 1 ? `, ×${row.count} identical pairs` : "";

      lines.push(
        `      ${row.a}`,
        `    ↔ ${row.b}`,
        `      ${row.triangles} triangles in ${row.planes[0]}${more}; overlap ${row.overlap.area} m² at (${row.overlap.centre.join(", ")})${copies}`,
      );
    }
  }

  if (report.badGeometry.length === 0) {
    lines.push("  ✓ no NaN geometry");
  } else {
    lines.push(
      `  ✗ ${report.badGeometry.length} mesh${report.badGeometry.length === 1 ? "" : "es"} with NaN geometry`,
    );

    for (const row of report.badGeometry) {
      lines.push(
        `      ${row.mesh}${row.under ? ` (${row.under})` : ""}: ${row.nonFinite} non-finite, ${row.zeroNormals} zero normals`,
      );
    }
  }

  if (top > 0 && report.meshes.length > 0) {
    lines.push("  most triangles:");

    for (const row of report.meshes) {
      lines.push(
        `      ${count(row.total).padStart(9)}  ${row.name}${row.instances > 1 ? ` ×${row.instances}` : ""}`,
      );
    }
  }

  return lines.join("\n");
};

export const main = async (argv: string[]): Promise<number> => {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        gap: { type: "string" },
        self: { type: "boolean", default: false },
        skip: { type: "string" },
        top: { type: "string" },
        json: { type: "boolean", default: false },
        "no-fail": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
  } catch (error) {
    console.error(`three-audit: ${(error as Error).message}\n\n${HELP}`);

    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    console.log(HELP);

    return 0;
  }

  if (values.version) {
    console.log(version());

    return 0;
  }

  if (positionals.length === 0) {
    console.error(HELP);

    return 2;
  }

  const gap = values.gap === undefined ? undefined : Number(values.gap);
  const top = values.top === undefined ? 5 : Number(values.top);

  if ((gap !== undefined && !(gap > 0)) || !(top >= 0)) {
    console.error("three-audit: --gap must be a positive number and --top zero or more");

    return 2;
  }

  const skipPattern = values.skip === undefined ? undefined : new RegExp(values.skip);
  const results: { file: string; report?: AuditReport; error?: string }[] = [];

  for (const file of positionals) {
    try {
      const scene = await loadModel(file);
      const report = auditScene(scene, {
        top,
        ...(gap === undefined ? {} : { gap }),
        ...(values.self ? { self: true } : {}),
        ...(skipPattern ? { skip: (object) => skipPattern.test(object.name) } : {}),
      });

      results.push({ file, report });
    } catch (error) {
      results.push({ file, error: (error as Error).message });
    }
  }

  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(
      results
        .map(({ file, report, error }) =>
          report
            ? printReport(file, report, top)
            : `${basename(file)}\n  ✗ couldn't read: ${error}`,
        )
        .join("\n\n"),
    );
  }

  if (results.some((result) => result.error !== undefined)) {
    return 2;
  }

  const failed = results.some(
    ({ report }) => report!.zFighting.length > 0 || report!.badGeometry.length > 0,
  );

  return failed && !values["no-fail"] ? 1 : 0;
};
