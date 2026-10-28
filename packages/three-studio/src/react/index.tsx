/**
 * `@zkmake/three-studio/react`: `<Studio>` is a whole mockups or model-studio page for React Three
 * Fiber, from a config of areas and variants; `<StudioRig>` adds the same wiring to a `<Canvas>`
 * the page builds itself. Variants read the page state through `useStudio()`, and freeze their
 * animations on `?t=` through `useStudioTime()`.
 */
import { Canvas, type CanvasProps, useFrame, useThree } from "@react-three/fiber";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import {
  resolveStudio,
  type StudioConfig,
  type StudioState,
  studioTime,
  type StudioVariant,
} from "../core/state.ts";
import { mountStudio, type MountStudioOptions, type StudioHandle } from "../ui/mount.ts";

/** A variant `<Studio>` can draw: what goes in the canvas, and optionally DOM over it. */
export type StudioReactVariant = StudioVariant & {
  render: (state: StudioState) => ReactNode;
  /** DOM over the canvas (a HUD mockup). Not in `saveShot`'s image, which is the canvas alone. */
  hud?: ((state: StudioState) => ReactNode) | undefined;
};

type RigOptions = Pick<
  MountStudioOptions,
  "controls" | "audit" | "overlay" | "globals" | "shotEndpoint"
>;

const StudioContext = createContext<StudioState | null>(null);

/** The page state: area, variant, view and switches. Inside `<Studio>` or `<StudioRig>`. */
export function useStudio(): StudioState {
  const state = useContext(StudioContext);

  if (!state) {
    throw new Error("three-studio: useStudio() needs a <Studio> or <StudioRig> above it");
  }

  return state;
}

/** Maps a clock time to the one to draw: frozen at `?t=` when set. */
export function useStudioTime(): (elapsed: number) => number {
  const state = useStudio();

  return (elapsed) => studioTime(state, elapsed);
}

export type StudioRigProps = RigOptions & {
  state: StudioState;
  /** Called once mounted, with the handle (`setView`, `saveShot`, `stats`). */
  onReady?: ((studio: StudioHandle) => void) | undefined;
  children?: ReactNode;
};

/**
 * Inside a `<Canvas>`: puts the camera at the state's view, adds orbit controls, three-audit's
 * console helpers, the overlay with its readout, and `window.studio`. Options are read on mount.
 * `saveShot` draws through R3F's own loop, so post-processing that renders in `useFrame` is kept.
 */
export function StudioRig({ state, onReady, children, ...options }: StudioRigProps) {
  const gl = useThree((root) => root.gl);
  const scene = useThree((root) => root.scene);
  const camera = useThree((root) => root.camera);
  const advance = useThree((root) => root.advance);
  const invalidate = useThree((root) => root.invalidate);
  const latest = useRef({ options, onReady });
  const handle = useRef<StudioHandle | null>(null);

  useEffect(() => {
    latest.current = { options, onReady };
  });

  useLayoutEffect(() => {
    const studio = mountStudio({
      ...latest.current.options,
      state,
      renderer: gl,
      scene,
      camera,
      render: () => advance(performance.now(), true),
    });
    const redraw = () => invalidate();

    studio.controls?.addEventListener("change", redraw);
    handle.current = studio;
    latest.current.onReady?.(studio);
    invalidate();

    return () => {
      studio.controls?.removeEventListener("change", redraw);
      handle.current = null;
      studio.dispose();
    };
  }, [state, gl, scene, camera, advance, invalidate]);

  useFrame(() => handle.current?.update());

  return <StudioContext.Provider value={state}>{children}</StudioContext.Provider>;
}

type CanvasOptions = Omit<CanvasProps, "children">;

export type StudioProps<V extends StudioReactVariant> = RigOptions & {
  config: StudioConfig<V>;
  /** The query to read. Default `window.location.search`. */
  search?: string | undefined;
  /**
   * The game's `<Canvas>` settings (tone mapping, `dpr`, `shadows`, fog in `scene`), so variants
   * look as they will in the game. A function gets the state, for per-area fog. `gl` objects are
   * merged over `{ preserveDrawingBuffer: true }`; `camera` objects over the view's lens.
   */
  canvas?: CanvasOptions | ((state: StudioState<V>) => CanvasOptions) | undefined;
  /** What every variant stands in: lights, ground, background. */
  stage?: ((state: StudioState<V>) => ReactNode) | undefined;
  onReady?: ((studio: StudioHandle) => void) | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
};

/**
 * A studio page: the canvas filling its parent, the variant inside a group tagged
 * `userData.studioObject = "<area>-<variant>"`, the stage around it, and the rig. Links reload the
 * page, so each variant mounts fresh.
 *
 *   createRoot(root).render(<Studio config={{ areas: { trees: { variants: TREES } } }} />);
 */
export function Studio<V extends StudioReactVariant>(props: StudioProps<V>) {
  const { config, search, stage, className, style, canvas, ...rig } = props;
  const state = useMemo(
    () => resolveStudio(config, search ?? globalThis.location?.search ?? ""),
    [config, search],
  );
  const own = typeof canvas === "function" ? canvas(state) : (canvas ?? {});
  const { view } = state;
  const lens = {
    fov: view.fov ?? 40,
    near: view.near ?? 0.1,
    far: view.far ?? 2000,
    position: [...view.position] as [number, number, number],
  };
  const gl =
    own.gl === undefined || isPlainObject(own.gl)
      ? { preserveDrawingBuffer: true, ...(own.gl as object | undefined) }
      : own.gl;
  const camera =
    own.camera === undefined || isPlainObject(own.camera)
      ? { ...lens, ...(own.camera as object | undefined) }
      : own.camera;

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, ...style }}
      data-studio={state.tag}
    >
      <Canvas {...own} gl={gl as CanvasProps["gl"]} camera={camera as CanvasProps["camera"]}>
        <StudioRig state={state} {...rig}>
          {stage?.(state)}
          <group userData={{ studioObject: state.tag }}>{state.variant.render(state)}</group>
        </StudioRig>
      </Canvas>
      {state.variant.hud ? (
        <StudioContext.Provider value={state}>{state.variant.hud(state)}</StudioContext.Provider>
      ) : null}
    </div>
  );
}

const isPlainObject = (value: unknown): value is object =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
