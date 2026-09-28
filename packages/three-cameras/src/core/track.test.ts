import { Group, type Line, PerspectiveCamera, type Points, Scene, Vector3 } from "three";
import type { Camera, Object3D } from "three";
import { afterEach, describe, expect, test, vi } from "vitest";

import { readChannel, sampleChannel, writeChannel } from "./channels.ts";
import { CameraLab } from "./lab.ts";
import { capturePose, type Pose } from "./pose.ts";
import { applyEase, cubicBezier, type Keyframe, PRESET_BEZIERS, sampleTrack } from "./track.ts";

const poseAt = (x: number, fov = 50): Pose => {
  const camera = new PerspectiveCamera(fov);

  camera.position.set(x, 0, 0);

  return capturePose(camera);
};

const key = (time: number, x: number, ease: Keyframe["ease"] = "linear", fov = 50): Keyframe => ({
  id: `k${time}`,
  time,
  pose: poseAt(x, fov),
  ease,
});

class FakeRenderer {
  render(_scene: Object3D, _camera: Camera) {}
}

describe("sampleTrack", () => {
  test("holds before the first key and after the last; none without keys", () => {
    const keys = [key(1, 0), key(3, 10)];

    expect(sampleTrack([], 1)).toBeNull();
    expect(sampleTrack(keys, 0)!.position[0]).toBe(0);
    expect(sampleTrack(keys, 5)!.position[0]).toBe(10);
  });

  test("between two keys: a straight line, paced by the ease; the lens too", () => {
    const linear = [key(0, 0, "linear", 40), key(2, 10, "linear", 60)];

    expect(sampleTrack(linear, 1)!.position[0]).toBeCloseTo(5);
    expect(sampleTrack(linear, 1)!.fov).toBeCloseTo(50);
    expect(sampleTrack([key(0, 0, "ease-in"), key(2, 10)], 1)!.position[0]).toBeCloseTo(1.25);
    expect(sampleTrack([key(0, 0, "hold"), key(2, 10)], 1.9)!.position[0]).toBe(0);
  });

  test("through three keys the path bends smoothly and passes each key", () => {
    const keys = [key(0, 0), key(1, 10), key(2, 0)];

    expect(sampleTrack(keys, 1)!.position[0]).toBeCloseTo(10);
    // Catmull-Rom overshoots a sharp turn a little, where a straight line wouldn't.
    expect(sampleTrack(keys, 0.9)!.position[0]).toBeGreaterThan(9);
  });

  test("eases start at 0 and end at 1", () => {
    for (const ease of ["linear", "ease-in", "ease-out", "ease-in-out"] as const) {
      expect([applyEase(ease, 0), applyEase(ease, 1)]).toEqual([0, 1]);
    }
  });
});

describe("timeline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const setUp = () => {
    vi.useFakeTimers();

    const camera = new PerspectiveCamera(50);

    camera.name = "crane";

    const scene = new Scene().add(camera);
    const renderer = new FakeRenderer();
    const saved: unknown[] = [];
    const lab = new CameraLab({
      scene,
      renderer,
      trackStore: { load: () => ({ tracks: {} }), save: (data) => void saved.push(data) },
    });
    const frame = (ms: number) => {
      vi.advanceTimersByTime(ms);
      renderer.render(scene, new PerspectiveCamera());
    };

    return { camera, lab, frame, saved };
  };

  test("keys from the camera as it is; a key at the same time replaces it", () => {
    const { camera, lab, saved } = setUp();

    lab.addKey("crane", { time: 0 });
    camera.position.x = 10;
    lab.addKey("crane", { time: 2 });
    camera.position.x = 20;
    lab.addKey("crane", { time: 2 });

    expect(lab.keys("crane").map((k) => [k.time, k.pose.position[0]])).toEqual([
      [0, 0],
      [2, 20],
    ]);
    expect(lab.entry("crane")!.keys).toBe(2);
    expect(saved).toHaveLength(3);
  });

  test("plays in real time on frames, loops, and stops at the end without loop", () => {
    const { camera, lab, frame } = setUp();

    lab.addKey("crane", { time: 0, ease: "linear" });
    camera.position.x = 10;
    lab.addKey("crane", { time: 2 });
    lab.setDuration(2);
    lab.seek(0);
    expect(camera.position.x).toBe(0);

    lab.play();
    frame(16);
    frame(50);
    frame(50);
    expect(lab.timeline().time).toBeCloseTo(0.1);
    expect(camera.position.x).toBeCloseTo(0.5);

    for (let i = 0; i < 20; i += 1) {
      frame(100);
    }

    // 2.1 s in on a 2 s loop.
    expect(lab.timeline().time).toBeCloseTo(0.1);

    lab.setLoop(false);

    for (let i = 0; i < 25; i += 1) {
      frame(100);
    }

    expect(lab.timeline()).toMatchObject({ time: 2, playing: false });
    expect(camera.position.x).toBeCloseTo(10);
  });

  test("scrubbing holds a camera the app moves; an edit lets it go; stop lets all go", () => {
    const { camera, lab, frame } = setUp();

    lab.addKey("crane", { time: 0 });
    lab.seek(0);

    // The app moves it every frame; the track puts it back before the frame draws.
    camera.position.x = 99;
    frame(16);
    expect(camera.position.x).toBe(0);

    lab.set("crane", { position: [5, 0, 0] });
    frame(16);
    expect(camera.position.x).toBe(5);

    lab.seek(0);
    expect(camera.position.x).toBe(0);

    lab.stop();
    camera.position.x = 42;
    frame(16);
    expect(camera.position.x).toBe(42);
  });

  test("update a key's time, ease or pose; delete it", () => {
    const { camera, lab } = setUp();
    const first = lab.addKey("crane", { time: 0 });

    lab.updateKey("crane", first.id, { time: 3, ease: "hold" });
    expect(lab.keys("crane")[0]).toMatchObject({ time: 3, ease: "hold" });

    camera.position.x = 7;
    lab.updateKey("crane", first.id, { recapture: true });
    expect(lab.keys("crane")[0]!.pose.position[0]).toBe(7);

    lab.deleteKey("crane", first.id);
    expect(lab.keys("crane")).toEqual([]);
  });

  test("select: the picked camera, shared by the panels", () => {
    const { lab } = setUp();
    const listener = vi.fn();

    lab.subscribe(listener);
    lab.select("crane");
    expect(lab.selected).toBe("crane");
    expect(lab.entry("crane")!.selected).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    lab.select("nope");
    expect(lab.selected).toBe("crane");
  });
});

describe("curves", () => {
  test("cubic Bézier: ends at 0 and 1, the linear handles are a line, CSS ease-in-out is symmetric", () => {
    expect([cubicBezier([0.4, 0, 0.2, 1], 0), cubicBezier([0.4, 0, 0.2, 1], 1)]).toEqual([0, 1]);
    expect(cubicBezier(PRESET_BEZIERS.linear, 0.3)).toBeCloseTo(0.3, 5);
    expect(cubicBezier([0.42, 0, 0.58, 1], 0.5)).toBeCloseTo(0.5, 5);
    expect(cubicBezier([0.42, 0, 0.58, 1], 0.25)).toBeCloseTo(
      1 - cubicBezier([0.42, 0, 0.58, 1], 0.75),
      5,
    );
  });

  test("an overshooting curve goes past the next key on the way", () => {
    const keys: Keyframe[] = [
      { ...key(0, 0), ease: "custom", bezier: [0.3, 1.6, 0.6, 1] },
      key(1, 10),
    ];
    const peak = Math.max(...[0.5, 0.6, 0.7, 0.8].map((t) => sampleTrack(keys, t)!.position[0]));

    expect(peak).toBeGreaterThan(10);
  });

  test("channels: read, write back, rotation through Euler degrees", () => {
    const camera = new PerspectiveCamera(40);

    camera.position.set(1, 2, 3);
    camera.rotation.set(0, Math.PI / 4, 0);

    const pose = capturePose(camera);

    expect([readChannel(pose, "px"), readChannel(pose, "fov")]).toEqual([1, 40]);
    expect(readChannel(pose, "ry")).toBeCloseTo(45);

    const turned = writeChannel(pose, "ry", 90);

    expect(readChannel(turned, "ry")).toBeCloseTo(90);
    expect(readChannel(pose, "ry")).toBeCloseTo(45);
    expect(writeChannel(pose, "pz", -3).position).toEqual([1, 2, -3]);
  });

  test("sampleChannel unwraps a turn past 180°", () => {
    const a = new PerspectiveCamera();
    const b = new PerspectiveCamera();

    a.rotation.set(0, 0, (170 * Math.PI) / 180);
    b.rotation.set(0, 0, (-170 * Math.PI) / 180);

    const points = sampleChannel(
      [
        { id: "a", time: 0, pose: capturePose(a), ease: "linear" },
        { id: "b", time: 1, pose: capturePose(b), ease: "linear" },
      ],
      "rz",
      0,
      1,
      10,
    );

    expect(points.at(-1)![1]).toBeCloseTo(190);
  });
});

describe("editing keys and paths", () => {
  test("a curve makes the ease custom, from the preset's shape; a preset clears it", () => {
    const camera = new PerspectiveCamera();

    camera.name = "crane";

    const lab = new CameraLab({ scene: new Scene().add(camera) });
    const first = lab.addKey("crane", { time: 0, ease: "ease-out" });

    lab.updateKey("crane", first.id, { ease: "custom" });
    expect(lab.keys("crane")[0]).toMatchObject({
      ease: "custom",
      bezier: PRESET_BEZIERS["ease-out"],
    });

    lab.updateKey("crane", first.id, { bezier: [0.1, 0.2, 0.3, 0.4] });
    expect(lab.keys("crane")[0]!.bezier).toEqual([0.1, 0.2, 0.3, 0.4]);

    lab.updateKey("crane", first.id, { ease: "linear" });
    expect(lab.keys("crane")[0]!.bezier).toBeUndefined();

    lab.updateKey("crane", first.id, { pose: writeChannel(first.pose, "py", 4) });
    expect(lab.keys("crane")[0]!.pose.position[1]).toBe(4);
  });

  test("the motion path: a line through the track and a dot per key, under the camera's parent", () => {
    const rig = new Group();
    const camera = new PerspectiveCamera();

    camera.name = "crane";
    rig.add(camera);

    const scene = new Scene().add(rig);
    const lab = new CameraLab({ scene });

    lab.addKey("crane", { time: 0 });
    camera.position.x = 10;
    lab.addKey("crane", { time: 2 });
    lab.setTrail("crane", true);

    const trail = rig.children.find((child) => child.userData.threeCameras)!;
    const [line, markers] = trail.children as [Line, Points];

    expect(lab.entry("crane")!.trail).toBe(true);
    expect(line.geometry.getAttribute("position").count).toBe(61);
    expect(markers.geometry.getAttribute("position").count).toBe(2);

    camera.position.x = 20;
    lab.addKey("crane", { time: 4 });
    expect(markers.geometry.getAttribute("position").count).toBe(3);

    lab.setTrail("crane", false);
    expect(rig.children).toEqual([camera]);
  });
});

describe("motion", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const moving = () => {
    vi.useFakeTimers();

    const rig = new Group();
    const camera = new PerspectiveCamera();

    camera.name = "dolly";
    rig.position.set(0, 1, 0);
    rig.add(camera);

    const scene = new Scene().add(rig);
    const renderer = {
      getCurrentViewport: (target: { set: (...v: number[]) => unknown }) =>
        target.set(0, 0, 800, 600),
      getRenderTarget: () => null,
      render: (_scene: Object3D, _camera: Camera) => {},
    };
    const view = new PerspectiveCamera(50, 800 / 600);
    const lab = new CameraLab({ scene, renderer });
    const frame = (x: number, z = 0) => {
      vi.advanceTimersByTime(100);
      camera.position.set(x, 0, z);
      renderer.render(scene, view);
    };

    return { camera, rig, lab, frame, view, renderer, scene };
  };

  test("an app-moved camera is recorded, marked moving, and its path drawn by itself", () => {
    const { lab, frame, rig } = moving();

    for (let i = 0; i <= 10; i += 1) {
      frame(i);
    }

    expect(lab.entry("dolly")).toMatchObject({ moving: true, recorded: true, trail: true });
    expect(lab.motion("dolly").length).toBeGreaterThan(5);

    const trail = rig.children.find((child) => child.userData.threeCameras)!;
    const recorded = trail.children[2] as Line;

    expect(recorded.geometry.getAttribute("position").count).toBe(lab.motion("dolly").length);

    // Still for over a second: no longer moving, and the automatic path goes.
    for (let i = 0; i < 12; i += 1) {
      frame(10);
    }

    expect(lab.entry("dolly")).toMatchObject({ moving: false, trail: false });
  });

  test("the renderer's own camera, outside the scene, gets no automatic path", () => {
    const { lab, frame, view } = moving();

    for (let i = 0; i < 5; i += 1) {
      view.position.x = i;
      frame(i);
    }

    expect(lab.entry("perspective camera")).toMatchObject({ inScene: false, trail: false });
  });

  test("bake: keys where the path bends, timed from the first sample; the path turns editable", () => {
    const { lab, frame } = moving();

    // Out along x for a second, then along z: one bend.
    for (let i = 0; i <= 10; i += 1) {
      frame(i);
    }

    for (let i = 1; i <= 10; i += 1) {
      frame(10, i);
    }

    const keys = lab.bakeMotion("dolly");

    expect(keys.map((key) => key.pose.position)).toEqual([
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 10],
    ]);
    expect(keys[0]!.time).toBe(0);
    expect(keys[2]!.time).toBeCloseTo(2, 1);
    expect(lab.keyHandles().map((handle) => handle.position.y)).toEqual([1, 1, 1]);
  });

  test("moveKeyTo: a world point lands in the parent's space", () => {
    const { lab, camera } = moving();
    const key = lab.addKey("dolly", { time: 0 });

    lab.moveKeyTo("dolly", key.id, new Vector3(2, 3, 4));
    expect(lab.keys("dolly")[0]!.pose.position).toEqual([2, 2, 4]);
    expect(camera.parent!.position.y).toBe(1);
  });

  test("the main view's matrices are kept, for turning screen points into rays", () => {
    const { lab, frame, view } = moving();

    view.position.set(0, 0, 10);
    frame(0);

    const transform = lab.viewTransform()!;

    expect(transform.viewport.toArray()).toEqual([0, 0, 800, 600]);
    expect(new Vector3().setFromMatrixPosition(transform.world).z).toBe(10);
  });
});
