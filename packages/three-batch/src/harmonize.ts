/**
 * Make a set of geometries mergeable and batchable. `mergeGeometries` and `BatchedMesh` both
 * refuse parts that disagree: one indexed and one not (an icosahedron beside a cone), one with uv
 * and one without, colours as bytes here and floats there. `harmonize` gives every part the same
 * index-ness and the same attributes, filling what a part lacks.
 */
import {
  BufferAttribute,
  type BufferGeometry,
  Float32BufferAttribute,
  type InterleavedBufferAttribute,
} from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

type AnyAttribute = BufferAttribute | InterleavedBufferAttribute;

export type HarmonizeOptions = {
  /** Every part indexed (the default when any part is) or none. */
  indexed?: boolean;
  /**
   * The value a part lacking an attribute gets on every vertex. Defaults: `color` white,
   * `normal` computed from the part's faces, anything else zeros.
   */
  fill?: Record<string, readonly number[]>;
};

type Shape = { itemSize: number; normalized: boolean; type: string };

const shapeOf = (attribute: AnyAttribute): Shape => ({
  itemSize: attribute.itemSize,
  normalized: attribute.normalized,
  type: attribute.array.constructor.name,
});

const getters = ["getX", "getY", "getZ", "getW"] as const;

/** A plain float copy: de-interleaved, de-normalised. */
const toFloat = (attribute: AnyAttribute) => {
  const out = new Float32Array(attribute.count * attribute.itemSize);

  for (let i = 0; i < attribute.count; i += 1) {
    for (let k = 0; k < attribute.itemSize; k += 1) {
      out[i * attribute.itemSize + k] = attribute[getters[k]!](i);
    }
  }

  return new Float32BufferAttribute(out, attribute.itemSize);
};

/** A plain copy of an interleaved attribute, keeping its type. */
const deinterleave = (attribute: InterleavedBufferAttribute) => {
  const TypedArray = attribute.array.constructor as new (length: number) => Float32Array;
  const out = new TypedArray(attribute.count * attribute.itemSize);

  for (let i = 0; i < attribute.count; i += 1) {
    for (let k = 0; k < attribute.itemSize; k += 1) {
      out[i * attribute.itemSize + k] = attribute[getters[k]!](i);
    }
  }

  return new BufferAttribute(out, attribute.itemSize, attribute.normalized);
};

const sequentialIndex = (geometry: BufferGeometry) => {
  const count = geometry.attributes.position?.count ?? 0;

  geometry.setIndex(Array.from({ length: count }, (_, i) => i));
};

/** Copies of `geometries`, all indexed or all not, all with the same attributes. Morph targets are dropped. */
export const harmonize = (
  geometries: readonly BufferGeometry[],
  options: HarmonizeOptions = {},
): BufferGeometry[] => {
  const indexed = options.indexed ?? geometries.some((geometry) => geometry.index !== null);
  const shapes = new Map<string, Shape[]>();

  for (const geometry of geometries) {
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      shapes.set(name, [...(shapes.get(name) ?? []), shapeOf(attribute)]);
    }
  }

  for (const [name, list] of shapes) {
    if (list.some((shape) => shape.itemSize !== list[0]!.itemSize)) {
      throw new Error(`three-batch: "${name}" has different item sizes across the geometries`);
    }
  }

  // Plain floats everywhere for an attribute whose array type or normalisation differs across
  // parts, or that some part lacks and isn't plain floats already (a fill value is a float).
  const asFloat = new Set(
    [...shapes]
      .filter(([, list]) => {
        const first = list[0]!;
        const mixed = list.some(
          (shape) => shape.type !== first.type || shape.normalized !== first.normalized,
        );
        const plainFloat = first.type === "Float32Array" && !first.normalized;

        return mixed || (list.length < geometries.length && !plainFloat);
      })
      .map(([name]) => name),
  );

  return geometries.map((source) => {
    let geometry = source.clone();

    geometry.morphAttributes = {};

    if (!indexed && geometry.index) {
      geometry = geometry.toNonIndexed();
    }

    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (asFloat.has(name)) {
        geometry.setAttribute(name, toFloat(attribute));
      } else if ((attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute) {
        geometry.setAttribute(name, deinterleave(attribute as InterleavedBufferAttribute));
      }
    }

    const count = geometry.attributes.position?.count ?? 0;

    for (const [name, list] of shapes) {
      if (geometry.hasAttribute(name)) {
        continue;
      }

      if (name === "normal" && options.fill?.normal === undefined) {
        geometry.computeVertexNormals();
        continue;
      }

      const { itemSize } = list[0]!;
      const value = options.fill?.[name] ?? (name === "color" ? [1, 1, 1, 1] : []);
      const out = new Float32Array(count * itemSize);

      for (let i = 0; i < count; i += 1) {
        for (let k = 0; k < itemSize; k += 1) {
          out[i * itemSize + k] = value[k] ?? 0;
        }
      }

      geometry.setAttribute(name, new Float32BufferAttribute(out, itemSize));
    }

    if (indexed && !geometry.index) {
      sequentialIndex(geometry);
    }

    return geometry;
  });
};

/**
 * An indexed copy with coincident vertices merged. Every attribute must agree for two vertices to
 * merge, so hard edges (split normals) stay split. What `BatchedMesh` far copies and meshoptimizer
 * want as input.
 */
export const weld = (geometry: BufferGeometry, tolerance = 1e-5) => {
  const welded = mergeVertices(geometry.index ? geometry.toNonIndexed() : geometry, tolerance);

  welded.name = geometry.name;

  return welded;
};
