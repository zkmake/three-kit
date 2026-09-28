/**
 * Draco for `GLTFLoader` in Node. three's `DRACOLoader` decodes in Web Workers, which Node lacks;
 * this is its decode run in-process on `draco3dgltf` (Google's Node build of the decoder),
 * shaped like the two methods `GLTFLoader` calls on it.
 */
import {
  BufferAttribute,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
} from "three";

type TypedArray =
  | Float32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;
type TypedArrayConstructor = {
  new (length: number): TypedArray;
  new (buffer: ArrayBufferLike, offset: number, length: number): TypedArray;
  BYTES_PER_ELEMENT: number;
};

/* The slice of the emscripten module this uses. */
type DracoAttribute = { num_components(): number };
type DracoMesh = { num_faces(): number; num_points(): number; ptr: number };
type DracoDecoder = {
  GetEncodedGeometryType(array: Int8Array): number;
  DecodeArrayToMesh(
    array: Int8Array,
    length: number,
    mesh: DracoMesh,
  ): { ok(): boolean; error_msg(): string };
  GetAttributeByUniqueId(mesh: DracoMesh, id: number): DracoAttribute;
  GetAttributeDataArrayForAllPoints(
    mesh: DracoMesh,
    attribute: DracoAttribute,
    type: number,
    byteLength: number,
    pointer: number,
  ): boolean;
  GetTrianglesUInt32Array(mesh: DracoMesh, byteLength: number, pointer: number): boolean;
};
type DracoModule = {
  Decoder: new () => DracoDecoder;
  Mesh: new () => DracoMesh;
  TRIANGULAR_MESH: number;
  HEAPF32: Float32Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  destroy(object: unknown): void;
  [type: `DT_${string}`]: number;
};

const DATA_TYPES: Record<string, string> = {
  Float32Array: "DT_FLOAT32",
  Int8Array: "DT_INT8",
  Int16Array: "DT_INT16",
  Int32Array: "DT_INT32",
  Uint8Array: "DT_UINT8",
  Uint16Array: "DT_UINT16",
  Uint32Array: "DT_UINT32",
};

const decodeAttribute = (
  draco: DracoModule,
  decoder: DracoDecoder,
  mesh: DracoMesh,
  attribute: DracoAttribute,
  ArrayType: TypedArrayConstructor,
) => {
  const count = mesh.num_points();
  const itemSize = attribute.num_components();
  // glTF aligns every vertex to 4 bytes; a narrower one is read interleaved.
  const srcBytes = itemSize * ArrayType.BYTES_PER_ELEMENT;
  const stride = (Math.ceil(srcBytes / 4) * 4) / ArrayType.BYTES_PER_ELEMENT;
  const byteLength = count * srcBytes;
  const pointer = draco._malloc(byteLength);

  decoder.GetAttributeDataArrayForAllPoints(
    mesh,
    attribute,
    draco[DATA_TYPES[ArrayType.name] as `DT_${string}`]!,
    byteLength,
    pointer,
  );

  const source = new ArrayType(
    draco.HEAPF32.buffer,
    pointer,
    byteLength / ArrayType.BYTES_PER_ELEMENT,
  );
  let array: TypedArray;

  if (stride === itemSize) {
    array = source.slice();
  } else {
    array = new ArrayType(count * stride);

    for (let i = 0; i < count; i += 1) {
      for (let k = 0; k < itemSize; k += 1) {
        array[i * stride + k] = source[i * itemSize + k]!;
      }
    }
  }

  draco._free(pointer);

  return stride === itemSize
    ? new BufferAttribute(array, itemSize)
    : new InterleavedBufferAttribute(new InterleavedBuffer(array, stride), itemSize, 0);
};

const decode = (
  draco: DracoModule,
  buffer: ArrayBuffer,
  attributeIds: Record<string, number>,
  attributeTypes: Record<string, string>,
) => {
  const decoder = new draco.Decoder();
  const array = new Int8Array(buffer);

  if (decoder.GetEncodedGeometryType(array) !== draco.TRIANGULAR_MESH) {
    draco.destroy(decoder);
    throw new Error("three-audit: Draco point clouds aren't supported");
  }

  const mesh = new draco.Mesh();
  const status = decoder.DecodeArrayToMesh(array, array.byteLength, mesh);

  if (!status.ok() || mesh.ptr === 0) {
    draco.destroy(mesh);
    draco.destroy(decoder);
    throw new Error(`three-audit: Draco decoding failed: ${status.error_msg()}`);
  }

  const geometry = new BufferGeometry();

  for (const [name, id] of Object.entries(attributeIds)) {
    const ArrayType = (globalThis as unknown as Record<string, TypedArrayConstructor>)[
      attributeTypes[name] ?? "Float32Array"
    ]!;

    geometry.setAttribute(
      name,
      decodeAttribute(draco, decoder, mesh, decoder.GetAttributeByUniqueId(mesh, id), ArrayType),
    );
  }

  const indices = mesh.num_faces() * 3;
  const pointer = draco._malloc(indices * 4);

  decoder.GetTrianglesUInt32Array(mesh, indices * 4, pointer);
  geometry.setIndex(
    new BufferAttribute(new Uint32Array(draco.HEAPF32.buffer, pointer, indices).slice(), 1),
  );
  draco._free(pointer);
  draco.destroy(mesh);
  draco.destroy(decoder);

  return geometry;
};

/** Stands in for `DRACOLoader` in `gltfLoader.setDRACOLoader(...)`. Needs `draco3dgltf`. */
export const createNodeDracoLoader = async () => {
  let module: { createDecoderModule(options: object): Promise<DracoModule> };

  try {
    module = ((await import("draco3dgltf")) as { default: typeof module }).default;
  } catch {
    throw new Error(
      "three-audit: this model is Draco-compressed; install draco3dgltf to read it (npm i -D draco3dgltf)",
    );
  }

  const draco = await module.createDecoderModule({});

  return {
    preload() {
      return this;
    },
    decodeDracoFile(
      buffer: ArrayBuffer,
      callback: (geometry: BufferGeometry) => void,
      attributeIds: Record<string, number>,
      attributeTypes: Record<string, string>,
      _colorSpace?: string,
      onError: (error: unknown) => void = () => {},
    ) {
      try {
        callback(decode(draco, buffer, attributeIds, attributeTypes));
      } catch (error) {
        onError(error);
      }
    },
  };
};
