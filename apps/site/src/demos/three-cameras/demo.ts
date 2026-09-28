/**
 * What both integrations share: their options and the set. A few props on a floor, and three
 * cameras in the scene: `dolly` circles the set and draws the picture-in-picture inset, so two
 * cameras are live at once (it and the orbit view); `overhead` (orthographic) and `security` sit
 * still, `security` with a keyframed move on the timeline to play. The orbit view is the
 * renderer's own camera, outside the scene, the way most apps have it.
 */
import type { CameraLab } from "@zkmake/three-cameras";
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  type Scene,
  TorusKnotGeometry,
  type WebGLRenderer,
} from "three";

import type { Demo, DemoBase } from "../../scripts/demo-page.ts";

type DemoOptions = DemoBase & {
  /** localStorage key prefix shared by both integrations, so the docks carry over. */
  storageKey: string;
};

type DemoFactory = (host: HTMLElement, options: DemoOptions) => Promise<Demo>;

type CameraSet = {
  group: Group;
  dolly: PerspectiveCamera;
  overhead: OrthographicCamera;
  security: PerspectiveCamera;
  /** Move the dolly and the props; `time` in ms. */
  update: (time: number) => void;
  dispose: () => void;
};

/** The inset's share of the canvas width, its margin from the left, and its top, below the header, px. */
const INSET_SHARE = 0.26;
const INSET_MARGIN = 16;
const INSET_TOP = 84;

/** A small camera body parented to a camera, behind its lens, so it shows where it stands. */
const body = (material: Material) => {
  const prop = new Group();
  const box = new Mesh(new BoxGeometry(0.34, 0.24, 0.42), material);
  const lens = new Mesh(new ConeGeometry(0.12, 0.2, 16), material);

  box.position.z = 0.26;
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.02;
  prop.add(box, lens);

  return prop;
};

const createSet = (): CameraSet => {
  const group = new Group();
  const materials = {
    floor: new MeshStandardMaterial({ color: "#3b4252", roughness: 0.9 }),
    red: new MeshStandardMaterial({ color: "#e76f51", roughness: 0.5 }),
    yellow: new MeshStandardMaterial({ color: "#e9c46a", roughness: 0.5 }),
    teal: new MeshStandardMaterial({ color: "#2a9d8f", roughness: 0.4 }),
    body: new MeshStandardMaterial({ color: "#1f2328", roughness: 0.6 }),
  };
  const floor = new Mesh(new CircleGeometry(7, 48), materials.floor);
  const knot = new Mesh(new TorusKnotGeometry(0.6, 0.2, 128, 16), materials.teal);
  const tall = new Mesh(new BoxGeometry(0.8, 2.2, 0.8), materials.red);
  const low = new Mesh(new BoxGeometry(1.4, 0.6, 1.4), materials.yellow);

  group.name = "set";
  floor.rotation.x = -Math.PI / 2;
  knot.position.set(0, 1.2, 0);
  tall.position.set(-2.4, 1.1, -1.2);
  low.position.set(2.2, 0.3, 1.4);
  group.add(floor, knot, tall, low);

  const dolly = new PerspectiveCamera(35, 16 / 10, 0.1, 50);
  const overhead = new OrthographicCamera(-6, 6, 4, -4, 0.1, 30);
  const security = new PerspectiveCamera(60, 4 / 3, 0.1, 40);

  dolly.name = "dolly";
  overhead.name = "overhead";
  security.name = "security";
  overhead.position.set(0, 12, 0);
  overhead.lookAt(0, 0, 0);
  security.position.set(5.5, 3.6, -4.5);
  security.lookAt(0, 0.6, 0);
  dolly.add(body(materials.body));
  security.add(body(materials.body));
  group.add(dolly, overhead, security);

  return {
    group,
    dolly,
    overhead,
    security,
    update: (time) => {
      const angle = time * 0.00018;

      dolly.position.set(
        Math.cos(angle) * 5.2,
        1.6 + Math.sin(time * 0.0007) * 0.3,
        Math.sin(angle) * 5.2,
      );
      dolly.lookAt(0, 1, 0);
      knot.rotation.set(time * 0.0003, time * 0.0004, 0);
    },
    dispose: () => {
      group.traverse((object) => {
        if ((object as Mesh).isMesh) {
          (object as Mesh).geometry.dispose();
        }
      });

      for (const material of Object.values(materials)) {
        material.dispose();
      }
    },
  };
};

/** The inset's rectangle in CSS px from the canvas's bottom-left, as three's viewport wants it. */
const insetRect = (width: number, height: number) => {
  const w = Math.round(width * INSET_SHARE);
  const h = Math.round(w / (16 / 10));

  return { x: INSET_MARGIN, y: height - INSET_TOP - h, w, h };
};

/** Draw the full view, then the dolly into the corner. */
const renderViews = (
  renderer: WebGLRenderer,
  scene: Scene,
  view: PerspectiveCamera,
  dolly: PerspectiveCamera,
  width: number,
  height: number,
) => {
  const inset = insetRect(width, height);

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
  renderer.render(scene, view);
  renderer.setScissorTest(true);
  renderer.setScissor(inset.x, inset.y, inset.w, inset.h);
  renderer.setViewport(inset.x, inset.y, inset.w, inset.h);
  // A hidden canvas has no size yet: keep the last good aspect rather than 0 / 0.
  if (inset.h > 0) {
    dolly.aspect = inset.w / inset.h;
    dolly.updateProjectionMatrix();
  }

  renderer.render(scene, dolly);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
};

/** A frame and label over the inset, so it reads as the dolly's picture. */
const insetFrame = (host: HTMLElement) => {
  const frame = document.createElement("div");

  frame.className = "inset-frame";
  frame.innerHTML = "<span>dolly</span>";
  host.append(frame);

  const place = () => {
    const inset = insetRect(host.clientWidth, host.clientHeight);

    Object.assign(frame.style, {
      left: `${INSET_MARGIN}px`,
      top: `${INSET_TOP}px`,
      width: `${inset.w}px`,
      height: `${inset.h}px`,
    });
  };

  place();

  return { place, remove: () => frame.remove() };
};

/** The security camera's shots: when, where it stands, what it looks at, and its fov. */
const SHOTS: [number, [number, number, number], [number, number, number], number][] = [
  [0, [5.5, 3.6, -4.5], [0, 0.6, 0], 60],
  [3, [1.8, 1.3, -5.2], [0, 1.1, 0], 38],
  [6, [-4.6, 2.2, -2.2], [0, 1, 0], 48],
  [9, [-3.2, 5.8, 4.2], [0, 0.4, 0], 66],
];

/**
 * A first track to play: the security camera's four shots, keyed through the lab's own API. Only
 * when it has none, so the viewer's edits (kept in localStorage) aren't overwritten. The camera
 * goes back to where it stood, and the timeline lets it go until played.
 */
const seedTrack = (lab: CameraLab, set: CameraSet) => {
  const camera = set.security;

  if (lab.keys("security").length > 0) {
    return;
  }

  const position = camera.position.clone();
  const quaternion = camera.quaternion.clone();
  const fov = camera.fov;

  for (const [time, at, look, lens] of SHOTS) {
    camera.position.set(...at);
    camera.lookAt(...look);
    camera.fov = lens;
    camera.updateProjectionMatrix();
    lab.addKey("security", { time });
  }

  camera.position.copy(position);
  camera.quaternion.copy(quaternion);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  lab.stop();
};

export { createSet, insetFrame, renderViews, seedTrack };
export type { CameraSet, DemoFactory, DemoOptions };
