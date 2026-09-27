/**
 * The checks as short console globals, for a dev page or a headless browser's `eval`:
 * `tris()`, `meshes()`, `census()`, `audit()`, `zfight()`, `report()`, and with a renderer
 * `ledger()` and `blackFrames()`.
 */
import type { Object3D } from "three";

import { auditScene } from "./audit-scene.ts";
import { findBadGeometry } from "./bad-geometry.ts";
import { type ProbeRenderer, watchBlackFrames } from "./black-frames.ts";
import { type LedgerRenderer, printDrawLedger, recordDrawLedger } from "./draw-ledger.ts";
import type { Skip } from "./scene.ts";
import { countTriangles, geometryCensus, listMeshes } from "./triangles.ts";
import { findZFighting } from "./z-fighting.ts";

export type AuditHelpersOptions = {
  /** A `WebGLRenderer`, for `ledger()` and `blackFrames()`. */
  renderer?: (LedgerRenderer & ProbeRenderer) | undefined;
  skip?: Skip | undefined;
  tagKey?: string;
};

const NAMES = [
  "auditRoot",
  "tris",
  "meshes",
  "census",
  "audit",
  "zfight",
  "report",
  "ledger",
  "blackFrames",
] as const;

const needsRenderer = (name: string) => () => {
  throw new Error(`three-audit: ${name}() needs installAuditHelpers(scene, { renderer })`);
};

/**
 * Put the helpers on `globalThis`. Returns a function that removes them.
 *
 *   vanilla: installAuditHelpers(scene, { renderer })
 *   R3F:     const { scene, gl } = useThree();
 *            useLayoutEffect(() => installAuditHelpers(scene, { renderer: gl }), [scene, gl]);
 */
export const installAuditHelpers = (root: Object3D, options: AuditHelpersOptions = {}) => {
  const { renderer, skip } = options;
  const tagKey = options.tagKey ?? "studioObject";

  const helpers: Record<(typeof NAMES)[number], unknown> = {
    auditRoot: root,
    tris: () => countTriangles(root, { skip }),
    meshes: () => listMeshes(root, { skip }),
    census: () => geometryCensus(root, { skip }),
    audit: () => findBadGeometry(root, { skip, tagKey }),
    zfight: (gap?: number, self?: boolean) =>
      findZFighting(root, {
        skip,
        tagKey,
        ...(gap === undefined ? {} : { gap }),
        ...(self === undefined ? {} : { self }),
      }),
    report: () => auditScene(root, { skip, tagKey }),
    ledger: renderer
      ? async () => {
          const ledger = await recordDrawLedger(renderer);

          printDrawLedger(ledger);

          return ledger;
        }
      : needsRenderer("ledger"),
    blackFrames: renderer
      ? (seconds = 10) =>
          new Promise<{ frames: number; blackFrames: readonly number[] }>((resolve) => {
            const watch = watchBlackFrames(renderer);

            setTimeout(() => {
              watch.stop();
              resolve({ frames: watch.frames, blackFrames: watch.blackFrames });
            }, seconds * 1000);
          })
      : needsRenderer("blackFrames"),
  };

  Object.assign(globalThis, helpers);

  return () => {
    const scope = globalThis as Record<string, unknown>;

    for (const name of NAMES) {
      if (scope[name] === helpers[name]) {
        delete scope[name];
      }
    }
  };
};
