/**
 * `three-audit model.glb [more.gltf …]`: load each model in Node and check it for z-fighting and
 * NaN geometry, and with `--budgets` against the app's budgets. Exits 1 when a check fails, so it
 * can gate CI; `--json` for machines.
 */
/* oxlint-disable no-console -- a CLI's output is the console */
import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { type AuditReport, auditScene } from "../audit-scene.ts";
import { type BudgetCheck, type Budgets, checkBudget, parseBudgets } from "../budgets.ts";
import { loadModel } from "../node/load.ts";
import {
  badGeometryLines,
  budgetLines,
  count,
  emptyMeshLines,
  meshLines,
  plural,
  zFightingLines,
} from "../report-lines.ts";
import type { AnyObject3D, Skip } from "../scene.ts";

const HELP = `Usage: three-audit <model.glb|model.gltf>… [options]

Checks glTF models for z-fighting (faces in one plane, facing the same way, overlapping) and
geometry that renders NaN (non-finite positions or normals, zero-length normals), and with
--budgets, that each fits its budget. Exits 1 when any model fails a check, 2 when a model or the
budgets can't be read.

Options:
  --gap <m>         How close two planes count as one, in metres (default 0.004)
  --self            Also check for z-fighting within each mesh (merged geometry)
  --skip <regex>    Leave out objects whose name matches, and everything under them (decals)
  --budgets <file>  The app's budgets: JSON, or a module whose default export is them
                    (defineBudgets). Each model is held to the part named like its file
                    (kart.glb: parts.kart) and to the frame's triangles and calls
  --part <name>     Hold every model to this part's budget instead
  --top <n>         List the n costliest meshes (default 5, 0 for none)
  --json            Print the reports as JSON
  --no-fail         Exit 0 even when a check fails
  -h, --help        Show this help
  -v, --version     Show the version

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

type Budgeted = {
  /** The part whose budget applied, `null` for the frame's alone. */
  part: string | null;
  checks: BudgetCheck[];
};

type Result = { file: string; report?: AuditReport; budget?: Budgeted; error?: string };

const printReport = (file: string, report: AuditReport, top: number, budget?: Budgeted) => {
  const lines = [
    `${basename(file)}  ${count(report.triangles)} triangles, ${count(report.draws)} draws`,
  ];

  if (report.zFighting.length === 0) {
    lines.push("  ✓ no z-fighting");
  } else {
    lines.push(
      `  ✗ ${report.zFighting.length} z-fighting ${plural(report.zFighting.length, "pair")}`,
      ...zFightingLines(report.zFighting),
    );
  }

  if (report.badGeometry.length === 0) {
    lines.push("  ✓ no NaN geometry");
  } else {
    lines.push(
      `  ✗ ${report.badGeometry.length} ${plural(report.badGeometry.length, "mesh", "meshes")} with NaN geometry`,
      ...badGeometryLines(report.badGeometry),
    );
  }

  if (report.emptyMeshes.length > 0) {
    lines.push(
      `  ! ${report.emptyMeshes.length} empty ${plural(report.emptyMeshes.length, "mesh", "meshes")} (no vertices)`,
      ...emptyMeshLines(report.emptyMeshes),
    );
  }

  if (budget) {
    const name = budget.part === null ? "the frame budget" : `budget "${budget.part}"`;

    if (budget.checks.length === 0) {
      lines.push(
        `  ! no budget for ${basename(file)}${budget.part === null ? ": name a part with --part" : ` in part "${budget.part}"`}`,
      );
    } else {
      lines.push(
        budget.checks.some((check) => check.over) ? `  ✗ over ${name}` : `  ✓ within ${name}`,
        ...budgetLines(budget.checks),
      );
    }
  }

  if (top > 0 && report.meshes.length > 0) {
    lines.push("  most triangles:", ...meshLines(report.meshes));
  }

  return lines.join("\n");
};

/** A budgets file: JSON, or a module whose default export (or the module itself) is the budgets. */
const readBudgets = async (file: string) => {
  const path = resolve(file);

  if (extname(path) === ".json") {
    return parseBudgets(JSON.parse(readFileSync(path, "utf8")));
  }

  const module = (await import(pathToFileURL(path).href)) as { default?: unknown };

  return parseBudgets(module.default ?? module);
};

/**
 * The model against its part's budget (`--part`, else the part named like the file) and the
 * frame's triangles and calls, which no one model may pass either.
 */
const budgetOf = (
  scene: AnyObject3D,
  file: string,
  budgets: Budgets,
  part: string | undefined,
  skip: Skip | undefined,
) => {
  const stem = basename(file, extname(file));
  const name = part ?? (Object.hasOwn(budgets.parts, stem) ? stem : null);
  const own = name === null ? [] : checkBudget(scene, budgets.parts[name]!, { skip });
  const frame = checkBudget(
    scene,
    { triangles: budgets.frame.triangles, calls: budgets.frame.calls },
    { skip },
  );
  // A part's limit is the tighter one; the frame's still applies to what the part leaves unset.
  const checks = [
    ...own,
    ...frame.filter((check) => !own.some((mine) => mine.metric === check.metric)),
  ];

  return { part: name, checks };
};

export const main = async (argv: string[]): Promise<number> => {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        budgets: { type: "string" },
        part: { type: "string" },
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

  if (values.part !== undefined && values.budgets === undefined) {
    console.error("three-audit: --part needs --budgets");

    return 2;
  }

  let budgets: Budgets | undefined;

  if (values.budgets !== undefined) {
    try {
      budgets = await readBudgets(values.budgets);
    } catch (error) {
      console.error(`three-audit: couldn't read ${values.budgets}: ${(error as Error).message}`);

      return 2;
    }

    if (values.part !== undefined && !Object.hasOwn(budgets.parts, values.part)) {
      const known = Object.keys(budgets.parts);

      console.error(
        `three-audit: no part "${values.part}" in ${values.budgets}${known.length > 0 ? ` (it has ${known.join(", ")})` : ""}`,
      );

      return 2;
    }
  }

  const skipPattern = values.skip === undefined ? undefined : new RegExp(values.skip);
  const skip: Skip | undefined = skipPattern
    ? (object) => skipPattern.test(object.name)
    : undefined;
  const results: Result[] = [];

  for (const file of positionals) {
    try {
      const scene = await loadModel(file);
      const report = auditScene(scene, {
        top,
        ...(gap === undefined ? {} : { gap }),
        ...(values.self ? { self: true } : {}),
        ...(skip ? { skip } : {}),
      });

      results.push({
        file,
        report,
        ...(budgets ? { budget: budgetOf(scene, file, budgets, values.part, skip) } : {}),
      });
    } catch (error) {
      results.push({ file, error: (error as Error).message });
    }
  }

  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(
      results
        .map(({ file, report, budget, error }) =>
          report
            ? printReport(file, report, top, budget)
            : `${basename(file)}\n  ✗ couldn't read: ${error}`,
        )
        .join("\n\n"),
    );
  }

  if (results.some((result) => result.error !== undefined)) {
    return 2;
  }

  const failed = results.some(
    ({ report, budget }) =>
      report!.zFighting.length > 0 ||
      report!.badGeometry.length > 0 ||
      budget?.checks.some((check) => check.over) === true,
  );

  return failed && !values["no-fail"] ? 1 : 0;
};
