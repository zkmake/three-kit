/**
 * Culling for things spread over a large area. A static `InstancedMesh` or merged geometry that
 * spans a whole world has one bounding sphere, so three never frustum-culls it: every instance
 * draws every frame, on screen or not, in the shadow pass too. These split it into cells, each with
 * its own bounds, so the cells out of view are skipped: a few more draw calls, far fewer triangles.
 *
 * For things built once and left alone. Anything that moves its instances each frame stays whole.
 * Pick `size` against how much of the world the camera sees at once.
 */
import {
  Box3,
  type BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  type Object3D,
  Sphere,
  Vector3,
} from "three";

export type ChunkOptions = {
  /** Cell size in world units (the mesh's local units). */
  size: number;
  /** Split along x, along z, or into an x-by-z grid (the default). */
  axes?: "x" | "z" | "xz";
};

const cellOf = (x: number, z: number, { size, axes = "xz" }: ChunkOptions) => {
  const cx = Math.floor(x / size);
  const cz = Math.floor(z / size);

  return axes === "x" ? `${cx}` : axes === "z" ? `${cz}` : `${cx},${cz}`;
};

const matrix = new Matrix4();
const color = new Color();
const position = new Vector3();

/** The object's own transform, name and flags onto the group that replaces it. */
const takePlace = (group: Group, from: Object3D) => {
  group.name = from.name;
  group.position.copy(from.position);
  group.quaternion.copy(from.quaternion);
  group.scale.copy(from.scale);
  group.visible = from.visible;
};

const copyDrawFlags = (to: Mesh, from: Mesh) => {
  to.castShadow = from.castShadow;
  to.receiveShadow = from.receiveShadow;
  to.renderOrder = from.renderOrder;
  to.layers.mask = from.layers.mask;
  to.customDepthMaterial = from.customDepthMaterial;
  to.customDistanceMaterial = from.customDistanceMaterial;
};

/**
 * Split an `InstancedMesh` into one per cell, by where each instance stands. Geometry and material
 * are shared; the original's instance buffers are disposed. Returns a group standing where the
 * mesh stood, cells named `<name>#<cell>`.
 */
export const chunkInstances = (mesh: InstancedMesh, options: ChunkOptions): Group => {
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
    if ((attribute as { isInstancedBufferAttribute?: boolean }).isInstancedBufferAttribute) {
      throw new Error(
        `three-batch: "${name}" is a per-instance attribute on the geometry; chunkInstances can't split it`,
      );
    }
  }

  const group = new Group();
  const cells = new Map<string, number[]>();

  takePlace(group, mesh);

  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);

    const cell = cellOf(position.x, position.z, options);
    const members = cells.get(cell);

    if (members) {
      members.push(index);
    } else {
      cells.set(cell, [index]);
    }
  }

  for (const [cell, members] of cells) {
    const piece = new InstancedMesh(mesh.geometry, mesh.material, members.length);

    piece.name = `${mesh.name}#${cell}`;
    copyDrawFlags(piece, mesh);

    members.forEach((from, to) => {
      mesh.getMatrixAt(from, matrix);
      piece.setMatrixAt(to, matrix);

      if (mesh.instanceColor) {
        mesh.getColorAt(from, color);
        piece.setColorAt(to, color);
      }
    });

    piece.instanceMatrix.needsUpdate = true;

    if (piece.instanceColor) {
      piece.instanceColor.needsUpdate = true;
    }

    piece.computeBoundingSphere();
    group.add(piece);
  }

  // The instance buffers go; the geometry and material are the cells' now.
  mesh.dispose();

  return group;
};

/**
 * Split one geometry into one per cell, by where each triangle's middle falls. The pieces share the
 * original's vertex buffers (uploaded once); only their indices are new. Keep the original for
 * physics or dispose it once the pieces are made.
 */
export const chunkGeometry = (
  geometry: BufferGeometry,
  options: ChunkOptions,
): BufferGeometry[] => {
  const positions = geometry.attributes.position;

  if (!positions) {
    return [];
  }

  const index = geometry.index;
  const count = index ? index.count : positions.count;
  const vertex = (corner: number) => (index ? index.getX(corner) : corner);
  const cells = new Map<string, number[]>();

  for (let corner = 0; corner + 2 < count; corner += 3) {
    const a = vertex(corner);
    const b = vertex(corner + 1);
    const c = vertex(corner + 2);
    const x = (positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3;
    const z = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3;
    const cell = cellOf(x, z, options);
    const members = cells.get(cell);

    if (members) {
      members.push(a, b, c);
    } else {
      cells.set(cell, [a, b, c]);
    }
  }

  const box = new Box3();
  const point = new Vector3();

  return [...cells].map(([cell, members]) => {
    const piece = new (geometry.constructor as typeof BufferGeometry)();

    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      piece.setAttribute(name, attribute);
    }

    piece.setIndex(members);
    piece.name = `${geometry.name}#${cell}`;
    box.makeEmpty();

    for (const member of members) {
      box.expandByPoint(point.fromBufferAttribute(positions, member));
    }

    piece.boundingBox = box.clone();
    piece.boundingSphere = box.getBoundingSphere(new Sphere());

    return piece;
  });
};

/** `chunkGeometry` for a mesh: a group standing where it stood, one mesh per cell. */
export const chunkMesh = (mesh: Mesh, options: ChunkOptions): Group => {
  const group = new Group();

  takePlace(group, mesh);

  for (const geometry of chunkGeometry(mesh.geometry, options)) {
    const piece = new Mesh(geometry, mesh.material as Material | Material[]);

    piece.name = `${mesh.name}${geometry.name.slice(geometry.name.lastIndexOf("#"))}`;
    copyDrawFlags(piece, mesh);
    group.add(piece);
  }

  return group;
};

/**
 * Let go of chunked instances: every `InstancedMesh` in the group (or the mesh itself, never
 * chunked) disposes its instance buffers. Shared geometry and materials stay.
 */
export const disposeChunks = (object: Object3D) => {
  object.traverse((part) => {
    if ((part as InstancedMesh).isInstancedMesh) {
      (part as InstancedMesh).dispose();
    }
  });
};
