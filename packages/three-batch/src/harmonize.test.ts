import {
  BoxGeometry,
  BufferAttribute,
  ConeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { describe, expect, test } from "vitest";

import { harmonize, weld } from "./harmonize.ts";

describe("harmonize", () => {
  test("an indexed and an unindexed part merge once harmonized", () => {
    const cone = new ConeGeometry(1, 2, 8);
    const ball = new IcosahedronGeometry(1);

    cone.deleteAttribute("uv");

    // Before: mergeGeometries refuses the mix (and logs why).
    expect(mergeGeometries([cone, ball])).toBeNull();

    const parts = harmonize([cone, ball]);

    expect(parts.every((part) => part.index !== null)).toBe(true);
    expect(parts[0]!.attributes.uv!.getX(0)).toBe(0);
    expect(mergeGeometries(parts)).not.toBeNull();
    // The sources are untouched.
    expect(cone.hasAttribute("uv")).toBe(false);
  });

  test("fills colour white, computes missing normals, takes custom fills", () => {
    const painted = new BoxGeometry();
    const bare = new BoxGeometry();

    painted.setAttribute(
      "color",
      new Float32BufferAttribute(new Float32Array(painted.attributes.position!.count * 3), 3),
    );
    painted.setAttribute(
      "finish",
      new Float32BufferAttribute(new Float32Array(painted.attributes.position!.count * 2), 2),
    );
    bare.deleteAttribute("normal");

    const [, filled] = harmonize([painted, bare], { fill: { finish: [0.5, 0.25] } });

    expect(filled!.attributes.color!.getY(3)).toBe(1);
    expect(filled!.attributes.finish!.getY(3)).toBe(0.25);
    expect(filled!.attributes.normal!.getY(8)).toBeCloseTo(1);
  });

  test("normalised byte colours and float colours become floats", () => {
    const bytes = new BoxGeometry();
    const floats = new BoxGeometry();
    const count = bytes.attributes.position!.count;

    bytes.setAttribute("color", new BufferAttribute(new Uint8Array(count * 3).fill(255), 3, true));
    floats.setAttribute("color", new Float32BufferAttribute(new Float32Array(count * 3), 3));

    const parts = harmonize([bytes, floats]);

    expect(parts[0]!.attributes.color!.array).toBeInstanceOf(Float32Array);
    expect(parts[0]!.attributes.color!.normalized).toBe(false);
    expect(parts[0]!.attributes.color!.getX(0)).toBe(1);
    expect(mergeGeometries(parts)).not.toBeNull();
  });

  test("de-interleaves and can drop the index", () => {
    const box = new BoxGeometry().toNonIndexed();
    const data = new InterleavedBuffer(box.attributes.position!.array as Float32Array, 3);

    box.setAttribute("position", new InterleavedBufferAttribute(data, 3, 0));

    const [plain, other] = harmonize([box, new BoxGeometry()], { indexed: false });

    expect(
      (plain!.attributes.position as { isInterleavedBufferAttribute?: boolean })
        .isInterleavedBufferAttribute,
    ).toBeUndefined();
    expect(other!.index).toBeNull();
  });

  test("refuses item sizes that disagree", () => {
    const a = new BoxGeometry();
    const b = new BoxGeometry();

    b.setAttribute(
      "uv",
      new Float32BufferAttribute(new Float32Array(b.attributes.uv!.count * 3), 3),
    );
    expect(() => harmonize([a, b])).toThrow(/"uv" has different item sizes/);
  });
});

describe("weld", () => {
  test("merges shared corners but keeps hard edges split", () => {
    const box = new BoxGeometry().toNonIndexed();

    box.deleteAttribute("uv");

    const welded = weld(box);

    // 36 corners; 24 distinct (position, normal) pairs: each face's 4 corners.
    expect(welded.attributes.position!.count).toBe(24);
    expect(welded.index!.count).toBe(36);
  });
});
