/**
 * The page's state, read from its URL: which area, which variant of it, which camera view, and
 * the shot switches (`clean`, `wire`, `t`). Pure: the same config and query give the same state,
 * so a link is a reproducible shot.
 *
 *   ?area=<area>&v=<variant>&view=<view>&clean=1&wire=1&t=<seconds>&shots=<port>
 *
 * A bare `?<area>` (`?plate`) also picks an area, the way single-object model studios link.
 */

export type Vec3 = readonly [number, number, number];

/** A camera pose. `fov`, `near` and `far` apply to a perspective camera, `zoom` to any. */
export type StudioView = {
  position: Vec3;
  target: Vec3;
  fov?: number | undefined;
  near?: number | undefined;
  far?: number | undefined;
  zoom?: number | undefined;
};

export type StudioViews = Readonly<Record<string, StudioView>>;

/** One look for one area. Adapters add what they render (`render`, `hud`); views it brings win. */
export type StudioVariant = {
  /** Its chip's text; the key otherwise. */
  label?: string | undefined;
  /** Views of its own (a camera variant's poses), over the area's and the page's. */
  views?: StudioViews | undefined;
};

export type StudioArea<V extends StudioVariant = StudioVariant> = {
  /** Its chip's text; the key otherwise. */
  title?: string | undefined;
  variants: Readonly<Record<string, V>>;
  /** Views for this area, over the page's. */
  views?: StudioViews | undefined;
};

export type StudioConfig<V extends StudioVariant = StudioVariant> = {
  /** In chip order; the first is the default. */
  areas: Readonly<Record<string, StudioArea<V>>>;
  /** Views every area has (`play`, copied from the game camera, belongs here). */
  views?: StudioViews | undefined;
  /** The view a link without `view=` opens, and the fallback for an unknown one. Default `play`. */
  defaultView?: string | undefined;
};

export type StudioState<V extends StudioVariant = StudioVariant> = {
  config: StudioConfig<V>;
  areaName: string;
  area: StudioArea<V>;
  variantName: string;
  variant: V;
  viewName: string;
  view: StudioView;
  /** Every view this variant can take: the page's, the area's, then its own. */
  views: StudioViews;
  /** `?clean=1`: no overlay, for shots taken of the whole window. */
  clean: boolean;
  /** `?wire=1`: every material drawn as wireframe, to read the topology. */
  wire: boolean;
  /** `?t=<s>`: animations frozen at this time, for steady shots; null when running. */
  time: number | null;
  /**
   * `?shots=<port>`: the port `three-studio serve` listens on, when it isn't the default 8787
   * (another receiver holds that one); `saveShot` posts there. Null for the default.
   */
  shots: number | null;
  /**
   * `<area>-<variant>`, for `userData.studioObject` on the variant's group, so three-audit's
   * `zfight()` and `summary()` audit only the thing under study.
   */
  tag: string;
  /** Names asked for in the URL that the config doesn't have; the defaults were used instead. */
  unknown: string[];
};

const FALLBACK_VIEW: StudioView = { position: [4, 3, 6], target: [0, 0.5, 0], fov: 40 };

const first = <T>(record: Readonly<Record<string, T>>): [string, T] | undefined =>
  Object.entries(record)[0];

/** Reads a `location.search` (or any query string) against the config. */
export function resolveStudio<V extends StudioVariant>(
  config: StudioConfig<V>,
  search: string,
): StudioState<V> {
  const params = new URLSearchParams(search);
  const unknown: string[] = [];
  const firstArea = first(config.areas);

  if (!firstArea) {
    throw new Error("three-studio: the config has no areas");
  }

  const bare = [...params.keys()].find((key) => params.get(key) === "" && key in config.areas);
  const askedArea = params.get("area") ?? bare ?? null;
  let [areaName, area] = firstArea;

  if (askedArea !== null) {
    const found = config.areas[askedArea];

    if (found) {
      [areaName, area] = [askedArea, found];
    } else {
      unknown.push(`area=${askedArea}`);
    }
  }

  const firstVariant = first(area.variants);

  if (!firstVariant) {
    throw new Error(`three-studio: area "${areaName}" has no variants`);
  }

  const askedVariant = params.get("v");
  let [variantName, variant] = firstVariant;

  if (askedVariant !== null) {
    const found = area.variants[askedVariant];

    if (found) {
      [variantName, variant] = [askedVariant, found];
    } else {
      unknown.push(`v=${askedVariant}`);
    }
  }

  const views: StudioViews = { ...config.views, ...area.views, ...variant.views };
  const defaultView = config.defaultView ?? "play";
  const askedView = params.get("view");
  const fallbackName = defaultView in views ? defaultView : (first(views)?.[0] ?? defaultView);
  let viewName = fallbackName;

  if (askedView !== null) {
    if (askedView in views) {
      viewName = askedView;
    } else {
      unknown.push(`view=${askedView}`);
    }
  }

  const shotsParam = params.get("shots");
  const shots = shotsParam === null || shotsParam === "" ? null : Number(shotsParam);
  const shotPort = shots !== null && Number.isInteger(shots) && shots > 0 && shots < 65536;

  if (shots !== null && !shotPort) {
    unknown.push(`shots=${shotsParam}`);
  }

  const time = params.get("t");
  const seconds = time === null || time === "" ? null : Number(time);

  if (seconds !== null && !Number.isFinite(seconds)) {
    unknown.push(`t=${time}`);
  }

  return {
    config,
    areaName,
    area,
    variantName,
    variant,
    viewName,
    view: views[viewName] ?? FALLBACK_VIEW,
    views,
    clean: flag(params.get("clean")),
    wire: flag(params.get("wire")),
    time: seconds !== null && Number.isFinite(seconds) ? seconds : null,
    shots: shotPort ? shots : null,
    tag: `${areaName}-${variantName}`,
    unknown,
  };
}

const flag = (value: string | null) => value !== null && value !== "0" && value !== "false";

export type StudioLink = {
  area?: string;
  variant?: string;
  view?: string;
  clean?: boolean;
  wire?: boolean;
  time?: number | null;
};

/**
 * The query for the state with `change` applied, `?` included. A new area starts at its first
 * variant; the view, the `wire` / `t` switches and `shots` carry over, `clean` only when asked for.
 */
export function studioHref(state: StudioState, change: StudioLink = {}): string {
  const area = change.area ?? state.areaName;
  const sameArea = area === state.areaName;
  const variant = change.variant ?? (sameArea ? state.variantName : undefined);
  const params = new URLSearchParams({ area });

  if (variant !== undefined) {
    params.set("v", variant);
  }

  params.set("view", change.view ?? state.viewName);

  if (change.wire ?? state.wire) {
    params.set("wire", "1");
  }

  if (change.clean) {
    params.set("clean", "1");
  }

  const time = change.time === undefined ? state.time : change.time;

  if (time !== null) {
    params.set("t", String(time));
  }

  if (state.shots !== null) {
    params.set("shots", String(state.shots));
  }

  return `?${params}`;
}

/** The animation time to draw at: the frozen `?t=` when set, the clock's otherwise. */
export const studioTime = (state: Pick<StudioState, "time">, elapsed: number): number =>
  state.time ?? elapsed;

/** An area's or variant's chip text. */
export const titleOf = (
  name: string,
  entry: { title?: string | undefined; label?: string | undefined },
) => entry.title ?? entry.label ?? name;
