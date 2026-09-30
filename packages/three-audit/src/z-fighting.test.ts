import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedBufferGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { describe, expect, test } from "vitest";

import { findZFighting } from "./z-fighting.ts";

const material = new MeshBasicMaterial();

const box = (name: string, size: [number, number, number], at: [number, number, number]) => {
  const mesh = new Mesh(new BoxGeometry(...size), material);

  mesh.name = name;
  mesh.position.set(...at);

  return mesh;
};

describe("findZFighting", () => {
  test("two boxes resting on one floor fight on their bottoms", () => {
    const scene = new Scene();

    // Both bottoms at y = 0, the plinth's footprint overlapping the wall's.
    scene.add(box("plinth", [2, 0.2, 2], [0, 0.1, 0]), box("wall", [1, 1, 1], [0, 0.5, 0]));

    const rows = findZFighting(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.a).toMatch(/^plinth /);
    expect(rows[0]!.b).toMatch(/^wall /);
    expect(rows[0]!.triangles).toBeGreaterThan(0);
    expect(rows[0]!.meshes.map((mesh) => mesh.name)).toEqual(["plinth", "wall"]);
  });

  test("a part stood 5 mm off is clean", () => {
    const scene = new Scene();

    scene.add(box("plinth", [2, 0.2, 2], [0, 0.1, 0]), box("wall", [1, 1, 1], [0, 0.505, 0]));

    expect(findZFighting(scene)).toEqual([]);
  });

  test("faces merely touching along an edge don't count", () => {
    const scene = new Scene();

    scene.add(box("left", [1, 1, 1], [-0.5, 0, 0]), box("right", [1, 1, 1], [0.5, 0, 0]));

    expect(findZFighting(scene)).toEqual([]);
  });

  test("opposite-facing coplanar faces don't count", () => {
    const scene = new Scene();
    const up = new Mesh(new PlaneGeometry(1, 1), material);
    const down = new Mesh(new PlaneGeometry(1, 1), material);

    up.rotation.x = -Math.PI / 2;
    down.rotation.x = Math.PI / 2;
    scene.add(up, down);

    expect(findZFighting(scene)).toEqual([]);
  });

  test("works in world space, through parent transforms", () => {
    const scene = new Scene();
    const group = new Group();
    const plane = new Mesh(new PlaneGeometry(1, 1), material);
    const decal = new Mesh(new PlaneGeometry(0.5, 0.5), material);

    group.position.set(10, 2, -3);
    group.rotation.y = 0.7;
    decal.position.set(0.1, 0.1, 0.002);
    group.add(plane);
    scene.add(group, decal);

    // The decal sits outside the group: it only fights once moved with it.
    expect(findZFighting(scene)).toEqual([]);

    group.add(decal);
    expect(findZFighting(scene)).toHaveLength(1);
    expect(findZFighting(scene, { gap: 0.001 })).toEqual([]);
  });

  test("far from the origin, nearly parallel faces apart don't pair", () => {
    const scene = new Scene();
    const quad = (name: string) => {
      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      mesh.name = name;
      mesh.rotation.x = -Math.PI / 2;

      return mesh;
    };
    const floor = quad("floor");
    const lid = quad("lid");
    // A lid 0.7 m over the floor, 30 m out, tipped about 1.4° — its plane's offset from the
    // origin comes out the same as the floor's, though it stands nowhere near it.
    const tilt = Math.asin(-0.718 / 30);

    floor.position.set(30, 1.2, 0);
    lid.position.set(30, 1.918, 0);
    lid.rotation.set(-Math.PI / 2, tilt, 0);
    scene.add(floor, lid);

    expect(findZFighting(scene)).toEqual([]);
  });

  test("far from the origin, coplanar faces still fight", () => {
    const scene = new Scene();

    scene.add(box("plinth", [2, 0.2, 2], [40, 0.1, -25]), box("wall", [1, 1, 1], [40, 0.5, -25]));

    expect(findZFighting(scene)).toHaveLength(1);
  });

  test("only tagged parts when anything is tagged", () => {
    const scene = new Scene();
    const object = new Group();
    // The ground slab shares both the foot's and the leg's top and bottom planes.
    object.userData.studioObject = "chair";
    object.add(box("foot", [1, 1, 1], [0, 0.5, 0]), box("leg", [0.5, 1, 0.5], [0, 0.5, 0]));
    scene.add(box("ground", [10, 1, 10], [0, 0.5, 0]), object);

    const rows = findZFighting(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.a).toMatch(/^chair\/foot /);
    expect(rows[0]!.b).toMatch(/^chair\/leg /);
    expect(findZFighting(scene, { tagged: false })).toHaveLength(3);

    const tagged = new Scene().add(box("a", [1, 1, 1], [0, 0, 0]), box("b", [1, 1, 1], [0, 0, 0]));

    expect(findZFighting(tagged)).toHaveLength(1);
    expect(findZFighting(tagged, { tagged: true })).toEqual([]);
  });

  test("skip prunes a subtree", () => {
    const scene = new Scene();
    const decals = new Group();

    decals.userData.decals = true;
    decals.add(box("sticker", [1, 1, 1], [0, 0, 0]));
    scene.add(box("wall", [1, 1, 1], [0, 0, 0]), decals);

    expect(findZFighting(scene)).toHaveLength(1);
    expect(findZFighting(scene, { skip: (o) => o.userData.decals === true })).toEqual([]);
  });

  test("self finds fights inside one merged geometry", () => {
    const a = new BoxGeometry(1, 1, 1);
    const b = new BoxGeometry(1, 1, 1).translate(0.5, 0, 0);
    const scene = new Scene().add(new Mesh(mergeGeometries([a, b]), material));

    expect(findZFighting(scene)).toEqual([]);
    expect(findZFighting(scene, { self: true })).toHaveLength(1);
  });

  test("ignores instanced meshes, degenerate triangles and non-indexed quirks", () => {
    const sliver = new BufferGeometry();

    sliver.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 0, 0], 3));

    const scene = new Scene().add(
      new InstancedMesh(new BoxGeometry(), material, 2),
      new Mesh(sliver, material),
      new Mesh(sliver, material),
      new Mesh(new BoxGeometry().toNonIndexed(), material),
    );

    expect(findZFighting(scene)).toEqual([]);
  });

  test("rows serialise without the meshes", () => {
    const scene = new Scene().add(box("a", [1, 1, 1], [0, 0, 0]), box("b", [1, 1, 1], [0, 0, 0]));
    const [row] = findZFighting(scene);

    expect(Object.keys(row!)).toEqual(["a", "b", "triangles", "planes", "overlap", "count"]);
    expect(JSON.parse(JSON.stringify(row))).toEqual({ ...row });
  });

  test("names the shared plane, its facing, and the overlap's area and centre", () => {
    const scene = new Scene();

    // The deck's end face and the panel's both lie in z = -3, facing -z, overlapping 1 × 0.3.
    scene.add(box("deck", [4, 0.4, 6], [0, 0.2, 0]), box("panel", [1, 2, 0.1], [1, 1.1, -2.95]));

    const [row] = findZFighting(scene);

    expect(row!.planes).toEqual(["z = -3.000, facing -z"]);
    expect(row!.overlap.area).toBeCloseTo(0.3, 4);
    expect(row!.overlap.centre).toEqual([1, 0.25, -3]);
  });

  test("labels a mesh by its named ancestors", () => {
    const bridge = new Group();
    const deck = new Group();

    bridge.userData.studioObject = "bridge";
    deck.name = "deck";
    bridge.add(deck.add(box("", [1, 1, 1], [0, 0, 0])), box("rail", [1, 1, 1], [0, 0, 0]));

    const [row] = findZFighting(new Scene().add(bridge));

    expect([row!.a, row!.b].sort()).toEqual([
      "bridge/deck/BoxGeometry [MeshBasicMaterial] @ (0, 0, 0)",
      "bridge/rail [MeshBasicMaterial] @ (0, 0, 0)",
    ]);
  });

  test("folds identical pairs into one row with a count", () => {
    const scene = new Scene();

    // Three pooled billboards, all parked at the origin: three identical pairs.
    for (let i = 0; i < 3; i += 1) {
      scene.add(box("star", [1, 1, 1], [0, 0, 0]));
    }

    const rows = findZFighting(scene);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.count).toBe(3);
    expect(rows[0]!.pairs).toHaveLength(3);
  });

  test("leaves out pairs that can't fight", () => {
    const pair = (a: MeshBasicMaterial, b: MeshBasicMaterial) => {
      const scene = new Scene();
      const one = box("one", [1, 1, 1], [0, 0, 0]);
      const two = box("two", [1, 1, 1], [0, 0, 0]);

      one.material = a;
      two.material = b;

      return findZFighting(scene.add(one, two));
    };
    const noWrite = () => new MeshBasicMaterial({ depthWrite: false });

    // Neither writes depth: draw order decides, nothing flickers.
    expect(pair(noWrite(), noWrite())).toEqual([]);
    // A decal that doesn't write depth over a wall that does still fights.
    expect(pair(noWrite(), new MeshBasicMaterial())).toHaveLength(1);
    // One side ignores depth entirely.
    expect(
      pair(new MeshBasicMaterial({ depthTest: false, depthWrite: false }), new MeshBasicMaterial()),
    ).toEqual([]);
    // Polygon offset is the usual decal fix.
    expect(
      pair(
        new MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: -1 }),
        new MeshBasicMaterial(),
      ),
    ).toEqual([]);
  });

  describe("bakes", () => {
    /** What three-batch's bake leaves: the parts hidden, one merged mesh beside them. */
    const baked = (flagged: boolean) => {
      const bridge = new Group();
      const deck = box("deck", [4, 0.4, 6], [0, 0.2, 0]);
      const panel = box("panel", [1, 2, 0.1], [1, 1.1, -2.95]);
      const merged = new Mesh(
        mergeGeometries(
          [deck, panel].map((part) => {
            part.updateMatrix();

            return part.geometry.clone().applyMatrix4(part.matrix);
          }),
        ),
        material,
      );

      for (const part of [deck, panel]) {
        part.visible = false;

        if (flagged) {
          part.userData.bakeSource = true;
        }
      }

      merged.name = "bridge:steel";
      merged.userData.bakedResult = true;
      bridge.add(deck, panel, merged);

      return new Scene().add(bridge);
    };

    test("checks a bake's hidden parts, not its merge", () => {
      for (const flagged of [true, false]) {
        const rows = findZFighting(baked(flagged));

        expect(rows).toHaveLength(1);
        expect([rows[0]!.a, rows[0]!.b].map((label) => label.split(" ")[0])).toEqual([
          "deck",
          "panel",
        ]);
      }
    });

    test("bakes: merged checks what's drawn", () => {
      expect(findZFighting(baked(true), { bakes: "merged" })).toEqual([]);
      expect(findZFighting(baked(true), { bakes: "merged", self: true })).toHaveLength(1);
    });

    test("other hidden meshes stay out", () => {
      const scene = baked(true);

      scene.add(box("ghost", [4, 0.4, 6], [0, 0.2, 0]));
      scene.children.at(-1)!.visible = false;

      expect(findZFighting(scene)).toHaveLength(1);
    });
  });

  test("leaves out hidden meshes and shader-positioned instanced geometry", () => {
    const hidden = box("hidden", [1, 1, 1], [0, 0, 0]);
    const source = new BoxGeometry();
    const lines = new InstancedBufferGeometry();

    lines.setIndex(source.index);
    lines.setAttribute("position", source.getAttribute("position"));

    const wind = new Mesh(lines, material);

    hidden.visible = false;

    expect(findZFighting(new Scene().add(box("a", [1, 1, 1], [0, 0, 0]), hidden, wind))).toEqual(
      [],
    );
  });
});
