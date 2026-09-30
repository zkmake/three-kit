/**
 * The checks as console globals, for a dev page or a headless browser's `eval`: `summary()`,
 * `tris()`, `meshes()`, `census()`, `audit()`, `zfight()`, `report()`, `bbox()`, `clearance()`,
 * and with a renderer `ledger()`, `beginLedger()` and `blackFrames()`. All of them also sit on
 * `threeAudit`, which is the only global with `globals: false`.
 */
import type { BatchedMesh } from "three";

import { auditScene, type AuditSummaryOptions, summarizeScene } from "./audit-scene.ts";
import { findBadGeometry } from "./bad-geometry.ts";
import { type ProbeRenderer, watchBlackFrames } from "./black-frames.ts";
import {
  beginDrawLedger,
  type DrawLedgerOptions,
  type LedgerRenderer,
  printDrawLedger,
  recordDrawLedger,
  type RecordDrawLedgerOptions,
} from "./draw-ledger.ts";
import { FRAME_TIMEOUT, nextFrame } from "./frames.ts";
import { measureBounds, measureClearance, type Target } from "./measure.ts";
import type { AnyObject3D, Bakes, Skip } from "./scene.ts";
import { type CensusOptions, countTriangles, geometryCensus, listMeshes } from "./triangles.ts";
import { findZFighting } from "./z-fighting.ts";

export type AuditHelpersOptions = {
  /** A `WebGLRenderer`, for `ledger()`, `beginLedger()` and `blackFrames()`. */
  renderer?: (LedgerRenderer & ProbeRenderer) | undefined;
  skip?: Skip | undefined;
  tagKey?: string;
  /** What checks see of a bake: its parts (default) or its merged meshes. See `Bakes`. */
  bakes?: Bakes | undefined;
  /** Names geometries inside a batch in `census()`: see `geometryCensus`'s `label`. */
  batchLabel?: ((batch: BatchedMesh, geometryId: number) => string | undefined) | undefined;
  /**
   * Also put each helper on `globalThis` under its short name (`tris`, `report`…). Default true;
   * false leaves only `threeAudit`, for pages where short names collide with other tooling.
   */
  globals?: boolean;
};

const NAMESPACE = "threeAudit";

const NAMES = [
  "auditRoot",
  "summary",
  "tris",
  "meshes",
  "census",
  "audit",
  "zfight",
  "report",
  "bbox",
  "clearance",
  "ledger",
  "beginLedger",
  "blackFrames",
] as const;

const needsRenderer = (name: string) => () => {
  throw new Error(`three-audit: ${name}() needs installAuditHelpers(scene, { renderer })`);
};

/**
 * Put the helpers on `globalThis`, and on `globalThis.threeAudit`. Returns a function that
 * removes them.
 *
 *   vanilla: installAuditHelpers(scene, { renderer })
 *   R3F:     const { scene, gl } = useThree();
 *            useLayoutEffect(() => installAuditHelpers(scene, { renderer: gl }), [scene, gl]);
 */
export const installAuditHelpers = (root: AnyObject3D, options: AuditHelpersOptions = {}) => {
  const { renderer, skip, batchLabel, bakes } = options;
  const tagKey = options.tagKey ?? "studioObject";

  const helpers: Record<(typeof NAMES)[number], unknown> = {
    auditRoot: root,
    summary: (tag?: string, summaryOptions: Pick<AuditSummaryOptions, "gap" | "zFighting"> = {}) =>
      summarizeScene(root, {
        skip,
        tagKey,
        bakes,
        ...summaryOptions,
        ...(tag === undefined ? {} : { tag }),
      }),
    tris: () => countTriangles(root, { skip }),
    meshes: () => listMeshes(root, { skip }),
    census: (censusOptions: Pick<CensusOptions, "budget" | "label"> = {}) =>
      geometryCensus(root, { skip, label: batchLabel, ...censusOptions }),
    audit: () => findBadGeometry(root, { skip, tagKey, bakes }),
    zfight: (gap?: number, self?: boolean) =>
      findZFighting(root, {
        skip,
        tagKey,
        bakes,
        ...(gap === undefined ? {} : { gap }),
        ...(self === undefined ? {} : { self }),
      }),
    report: (tag?: string) =>
      auditScene(root, { skip, tagKey, bakes, ...(tag === undefined ? {} : { tag }) }),
    bbox: (target: Target) => measureBounds(root, target, { tagKey, bakes }),
    clearance: (a: Target, b: Target) => measureClearance(root, a, b, { tagKey, bakes }),
    ledger: renderer
      ? async (ledgerOptions?: RecordDrawLedgerOptions) => {
          const ledger = await recordDrawLedger(renderer, ledgerOptions);

          printDrawLedger(ledger);

          return ledger;
        }
      : needsRenderer("ledger"),
    beginLedger: renderer
      ? (ledgerOptions?: DrawLedgerOptions) => {
          const recording = beginDrawLedger(renderer, ledgerOptions);

          return {
            end: () => {
              const ledger = recording.end();

              printDrawLedger(ledger);

              return ledger;
            },
          };
        }
      : needsRenderer("beginLedger"),
    blackFrames: renderer
      ? async (seconds = 10) => {
          await nextFrame(
            "blackFrames()",
            FRAME_TIMEOUT,
            "Black frames only show in a visible tab: bring it to the front.",
          );

          const watch = watchBlackFrames(renderer);

          return new Promise<{ frames: number; blackFrames: readonly number[] }>((resolve) => {
            setTimeout(() => {
              watch.stop();
              resolve({ frames: watch.frames, blackFrames: watch.blackFrames });
            }, seconds * 1000);
          });
        }
      : needsRenderer("blackFrames"),
  };
  const namespace = { ...helpers };
  const scope = globalThis as Record<string, unknown>;

  if (options.globals !== false) {
    Object.assign(scope, helpers);
  }

  scope[NAMESPACE] = namespace;

  return () => {
    for (const name of NAMES) {
      if (scope[name] === helpers[name]) {
        delete scope[name];
      }
    }

    if (scope[NAMESPACE] === namespace) {
      delete scope[NAMESPACE];
    }
  };
};
