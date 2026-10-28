/**
 * `@zkmake/three-studio`: a dev page's state from its URL (areas, variants, views, shot switches),
 * camera views, the draw-call readout, wireframe, and canvas screenshots. No DOM at import; the
 * overlay and mount are in `/ui`, the React Three Fiber page in `/react`, the PNG tools in
 * `/node`.
 */
export {
  canvasPng,
  installFrameShim,
  type SaveShotOptions,
  saveShot,
  SHOT_PORT,
  type ShotSize,
} from "./core/capture.ts";
export {
  type FrameStats,
  formatStats,
  frameStats,
  setWireframe,
  type StatsRenderer,
} from "./core/frame.ts";
export {
  resolveStudio,
  type StudioArea,
  type StudioConfig,
  studioHref,
  type StudioLink,
  type StudioState,
  studioTime,
  type StudioVariant,
  type StudioView,
  type StudioViews,
  titleOf,
  type Vec3,
} from "./core/state.ts";
export { applyView, orbitViews, type OrbitViewsOptions, type ViewControls } from "./core/views.ts";
