import { BoxGeometry, BufferGeometry, Group, Mesh, MeshBasicMaterial, Scene } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { afterEach, describe, expect, test, vi } from "vitest";

import { auditScene, summarizeScene } from "./audit-scene.ts";
import { installAuditHelpers } from "./console-helpers.ts";

const scope = globalThis as Record<string, unknown>;
const call = (name: string, ...args: unknown[]) =>
  (scope[name] as (...a: unknown[]) => unknown)(...args);

const scene = () => {
  const material = new MeshBasicMaterial();
  const a = new Mesh(new BoxGeometry(), material);
  const b = new Mesh(new BoxGeometry(), material);

  a.name = "a";
  b.name = "b";

  return new Scene().add(a, b);
};

describe("installAuditHelpers", () => {
  let uninstall = () => {};

  afterEach(() => uninstall());

  test("puts the checks on globalThis and takes them off again", () => {
    const root = scene();

    uninstall = installAuditHelpers(root);

    expect(scope.auditRoot).toBe(root);
    expect(call("tris")).toBe(24);
    expect(call("meshes")).toHaveLength(2);
    expect(call("census")).toHaveLength(2);
    expect(call("audit")).toEqual([]);
    expect(call("zfight")).toHaveLength(1);
    expect(call("zfight", 0.004, false)).toHaveLength(1);
    expect(call("report")).toEqual(auditScene(root));
    expect(() => call("ledger")).toThrow(/renderer/);

    uninstall();
    expect(scope.tris).toBeUndefined();
    expect(scope.auditRoot).toBeUndefined();
    expect(scope.threeAudit).toBeUndefined();
  });

  test("puts them on threeAudit too, and only there with globals: false", () => {
    uninstall = installAuditHelpers(scene(), { globals: false });

    const namespace = scope.threeAudit as Record<string, (...a: unknown[]) => unknown>;

    expect(scope.tris).toBeUndefined();
    expect(namespace.tris!()).toBe(24);
    expect(namespace.zfight!()).toHaveLength(1);
  });

  test("beginLedger brackets draws by hand; ledger({ render }) records one call", async () => {
    const draws: string[] = [];
    const renderer = {
      render: () => {},
      renderBufferDirect: (..._args: unknown[]) => draws.push("draw"),
      getContext: () => null,
      getRenderTarget: () => null,
    };
    const drawOnce = () =>
      renderer.renderBufferDirect(null, null, null, { type: "M" }, { name: "box" }, null);

    vi.spyOn(console, "group").mockImplementation(() => {});
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});
    uninstall = installAuditHelpers(scene(), { renderer: renderer as never });

    const recording = (call("beginLedger") as { end: () => { draws: number } }) ?? null;

    drawOnce();
    drawOnce();
    expect(recording.end().draws).toBe(2);

    const ledger = (await call("ledger", { render: drawOnce })) as { objects: { name: string }[] };

    expect(ledger.objects).toEqual([{ name: "box", total: 1, passes: { direct: 1 } }]);
    vi.restoreAllMocks();
  });

  test("leaves a newer install's globals alone", () => {
    const first = installAuditHelpers(scene());

    uninstall = installAuditHelpers(scene());
    first();

    expect(typeof scope.tris).toBe("function");
  });
});

describe("summarizeScene and tags", () => {
  const studio = () => {
    const material = new MeshBasicMaterial();
    const bridge = new Group();
    const train = new Group();
    const merged = new Mesh(
      mergeGeometries([new BoxGeometry(), new BoxGeometry().translate(0.5, 0, 0)]),
      material,
    );

    bridge.userData.studioObject = "bridge";
    train.userData.studioObject = "train";
    merged.position.x = 5;
    bridge.add(
      new Mesh(new BoxGeometry(), material),
      new Mesh(new BoxGeometry(), material),
      merged,
      new Mesh(new BufferGeometry(), material),
    );
    train.add(new Mesh(new BoxGeometry(), material));

    return new Scene().add(bridge, train, new Mesh(new BoxGeometry(4, 0.1, 4), material));
  };
  let uninstallAll = () => {};

  afterEach(() => uninstallAll());

  test("counts every check for one tagged object", () => {
    expect(summarizeScene(studio(), { tag: "bridge" })).toEqual({
      triangles: 48,
      draws: 4,
      meshes: 4,
      zFighting: 1,
      selfZFighting: 1,
      badGeometry: 0,
      emptyMeshes: 1,
    });
    expect(summarizeScene(studio(), { tag: "train" })).toMatchObject({
      triangles: 12,
      zFighting: 0,
    });
  });

  test("zFighting: false skips the slow check", () => {
    expect(summarizeScene(studio(), { tag: "bridge", zFighting: false })).toMatchObject({
      zFighting: null,
      selfZFighting: null,
    });
  });

  test("an unknown tag throws", () => {
    expect(() => summarizeScene(studio(), { tag: "tunnel" })).toThrow(/"tunnel"/);
  });

  test("report narrows to a tag", () => {
    const report = auditScene(studio(), { tag: "bridge" });

    expect(report.triangles).toBe(48);
    expect(report.emptyMeshes.map((row) => row.mesh)).toEqual([
      "bridge/BufferGeometry [MeshBasicMaterial]",
    ]);
  });

  test("summary, census, bbox and clearance globals", () => {
    uninstallAll = installAuditHelpers(studio());

    expect(call("summary", "train")).toMatchObject({ triangles: 12 });
    expect(call("census", { budget: 0.9 })).toContainEqual(
      expect.objectContaining({ overBudget: false }),
    );
    expect(call("bbox", "train")).toEqual({
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
      size: [1, 1, 1],
      centre: [0, 0, 0],
    });
    expect(() => call("clearance", "train", "tunnel")).toThrow(/tunnel/);
  });
});

describe("auditScene", () => {
  test("is JSON-safe", () => {
    const report = auditScene(scene(), { top: 1 });

    expect(JSON.parse(JSON.stringify(report))).toEqual({
      triangles: 24,
      zFighting: [
        {
          a: expect.stringMatching(/^a /),
          b: expect.stringMatching(/^b /),
          triangles: 12,
          planes: expect.any(Array),
          overlap: { area: 6, centre: [0, 0, 0] },
          count: 1,
        },
      ],
      draws: 2,
      badGeometry: [],
      emptyMeshes: [],
      meshes: [
        { name: "a", material: "MeshBasicMaterial", triangles: 12, instances: 1, total: 12 },
      ],
    });
  });
});
