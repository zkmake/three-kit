import { name, version } from "../../package.json";
import type { PerformanceMonitor } from "../core/performance-monitor.ts";
import type { CostEntry, FrameStats, Sample, TimingMetric } from "../core/types.ts";
import {
  type BudgetKey,
  type Budgets,
  isFloor,
  isOverBudget,
  type ResolvedBudgets,
  resolveBudgets,
} from "./budgets.ts";
import { copyText } from "./clipboard.ts";
import { formatCount } from "./format.ts";
import { HudSettings } from "./hud-settings.ts";
import { createIcon, type IconName } from "./icons.ts";
import { METRIC_HELP } from "./metric-help.ts";
import { backendLabel, formatReport } from "./report.ts";
import { drawSparkline, type SparklineStyle } from "./sparkline.ts";
import { applyTheme, HudTheme, type ResolvedTheme, type ThemeMode } from "./theme.ts";

type PerformanceViewMode = "full" | "compact";

type PerformanceViewOptions = {
  monitor: PerformanceMonitor;
  /** `full` is the checkbox list; `compact` the card it configures. Default `full`. */
  mode?: PerformanceViewMode;
  /** Repaint rate. Default 10. */
  refreshHz?: number;
  /**
   * Limits past which a value turns amber. Timing budgets default from
   * `targetFps` (60); `false` turns them all off. See {@link Budgets}.
   */
  budgets?: Budgets | false;
  /** Share one between views to keep them in sync; a fresh instance otherwise. */
  settings?: HudSettings;
  /**
   * Share the host's so the card and its chrome switch together. Otherwise a
   * fresh `system` instance is created and disposed with the view.
   */
  theme?: HudTheme;
};

type TimingConfig = {
  format: (value: number) => string;
  icon: IconName;
  label: string;
  metric: TimingMetric;
  /** Canvas can't read CSS custom properties, so the sparkline palette lives here per theme. */
  style: Record<ResolvedTheme, SparklineStyle>;
  unit: string;
};

type NumberConfig = {
  format: (value: number) => string;
  icon: IconName;
  key: BudgetKey;
  label: string;
  unit?: "ms";
  /** `null` until known: no frames yet, or no GPU timer. */
  value: (sample: Sample, stats: FrameStats) => number | null;
};

const TIMINGS: TimingConfig[] = [
  {
    format: (value) => Math.round(value).toString(),
    icon: "gauge",
    label: "FPS",
    metric: "fps",
    style: {
      dark: { fill: "rgba(74, 222, 128, 0.15)", stroke: "#4ade80" },
      light: { fill: "rgba(22, 163, 74, 0.12)", stroke: "#16a34a" },
    },
    unit: "",
  },
  {
    format: (value) => value.toFixed(1),
    icon: "cpu",
    label: "CPU",
    metric: "cpu",
    style: {
      dark: { fill: "rgba(96, 165, 250, 0.15)", stroke: "#60a5fa" },
      light: { fill: "rgba(37, 99, 235, 0.12)", stroke: "#2563eb" },
    },
    unit: "ms",
  },
  {
    format: (value) => value.toFixed(1),
    icon: "zap",
    label: "GPU",
    metric: "gpu",
    style: {
      dark: { fill: "rgba(244, 114, 182, 0.15)", stroke: "#f472b6" },
      light: { fill: "rgba(219, 39, 119, 0.12)", stroke: "#db2777" },
    },
    unit: "ms",
  },
];

const THEME_OPTIONS: { icon: "sun" | "monitor" | "moon"; label: string; mode: ThemeMode }[] = [
  { icon: "sun", label: "Light theme", mode: "light" },
  { icon: "monitor", label: "Match the system theme", mode: "system" },
  { icon: "moon", label: "Dark theme", mode: "dark" },
];

/** The monorepo tags each package's releases `@zkmake/three-meter@0.9.2`. */
const RELEASE_URL = `https://github.com/zkmake/three-kit/releases/tag/${encodeURIComponent(`${name}@${version}`)}`;

/** How long the report button says `copied` / `failed` before reading `copy` again. */
const COPY_FEEDBACK_MS = 1500;

/** Walking the scene graph isn't free; the top-costs list refreshes at 2 Hz while open. */
const COSTS_INTERVAL_MS = 500;
const COSTS_ROWS = 5;

type CostGroup = "meshes" | "materials";
type CostSort = "calls" | "triangles";

const COST_GROUPS: { group: CostGroup; label: string }[] = [
  { group: "meshes", label: "meshes" },
  { group: "materials", label: "materials" },
];

const COSTS_HELP =
  "The scene's biggest draw costs in the main render pass, estimated from the scene graph. Hidden and off-screen objects are left out; shadow and post-processing passes aren't counted. Click a row to log its objects to the console.";

/** `×2,000` for instances or copies; nothing for a single object. */
const copiesOf = (entry: CostEntry) =>
  entry.instances > 1 ? `×${formatCount(entry.instances)}` : "";

const costTitle = (entry: CostEntry) => {
  const objects = entry.objects.length;
  const shape =
    entry.instances > objects
      ? `${formatCount(entry.instances)} instances in ${objects === 1 ? "one object" : `${objects} objects`}`
      : `${formatCount(objects)} ${objects === 1 ? "object" : "separate objects"}`;

  return `${entry.label}: ${shape}, ${formatCount(entry.calls)} draw ${entry.calls === 1 ? "call" : "calls"}, ${formatCount(entry.triangles)} triangles. Click to log to the console.`;
};

const readTiming = (sample: Sample, metric: TimingMetric) => {
  switch (metric) {
    case "fps":
      return sample.fps;
    case "cpu":
      return sample.cpu;
    case "gpu":
      return sample.gpu.ms;
  }
};

const isTimingAvailable = (sample: Sample, metric: TimingMetric) =>
  metric !== "gpu" || sample.gpu.available;

const whole = (value: number) => Math.round(value).toString();
const tenths = (value: number) => value.toFixed(1);

const NUMBERS: NumberConfig[] = [
  { format: whole, icon: "gauge", key: "fps", label: "FPS", value: (sample) => sample.fps || null },
  {
    format: formatCount,
    icon: "layers",
    key: "calls",
    label: "Calls",
    value: (sample) => sample.render.calls,
  },
  {
    format: tenths,
    icon: "cpu",
    key: "cpu",
    label: "CPU",
    unit: "ms",
    value: (sample) => sample.cpu,
  },
  {
    format: tenths,
    icon: "zap",
    key: "gpu",
    label: "GPU",
    unit: "ms",
    value: (sample) => (sample.gpu.available ? sample.gpu.ms : null),
  },
  {
    format: whole,
    icon: "trendingDown",
    key: "low",
    label: "1% low",
    value: (_sample, stats) => (stats.frames ? stats.lowFps : null),
  },
  {
    format: tenths,
    icon: "timer",
    key: "p99",
    label: "Frame p99",
    unit: "ms",
    value: (_sample, stats) => (stats.frames ? stats.p99Ms : null),
  },
  {
    format: formatCount,
    icon: "activity",
    key: "hitches",
    label: "Hitches",
    value: (_sample, stats) => (stats.frames ? stats.hitches : null),
  },
  {
    format: formatCount,
    icon: "triangle",
    key: "triangles",
    label: "Triangles",
    value: (sample) => sample.render.triangles,
  },
  {
    format: formatCount,
    icon: "spline",
    key: "lines",
    label: "Lines",
    value: (sample) => sample.render.lines,
  },
  {
    format: formatCount,
    icon: "circleDot",
    key: "points",
    label: "Points",
    value: (sample) => sample.render.points,
  },
  {
    format: formatCount,
    icon: "repeat",
    key: "passes",
    label: "Render passes",
    value: (sample) => sample.render.passes,
  },
  {
    format: formatCount,
    icon: "box",
    key: "geometries",
    label: "Geometries",
    value: (sample) => sample.resources.geometries,
  },
  {
    format: formatCount,
    icon: "image",
    key: "textures",
    label: "Textures",
    value: (sample) => sample.resources.textures,
  },
  {
    format: formatCount,
    icon: "palette",
    key: "shaders",
    label: "Shaders",
    value: (sample) => sample.resources.programs,
  },
];

const NUMBER_BY_KEY = new Map(NUMBERS.map((config) => [config.key, config]));

/** Canvas can't read CSS custom properties; the budget line's amber per theme. */
const GUIDE_COLOR: Record<ResolvedTheme, string> = {
  dark: "rgba(245, 158, 11, 0.75)",
  light: "rgba(180, 83, 9, 0.7)",
};

/** `Budget: at most 16.7 ms` / `at least 57`, or `""` without one. */
const budgetTitle = (budgets: ResolvedBudgets, key: BudgetKey) => {
  const limit = budgets.limits[key];
  const config = NUMBER_BY_KEY.get(key);

  if (limit === undefined || !config) {
    return "";
  }

  const bound = isFloor(key) ? "at least" : "at most";

  return `Budget: ${bound} ${config.format(limit)}${config.unit ? ` ${config.unit}` : ""}`;
};

/** The sample value a timing graph shows, `null` when not known. */
const timingValue = (sample: Sample, metric: TimingMetric) => {
  if (!isTimingAvailable(sample, metric)) {
    return null;
  }

  const value = readTiming(sample, metric);

  return metric === "fps" && value === 0 ? null : value;
};

type GraphCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  height: number;
  width: number;
};

type HudGraph = GraphCanvas & {
  valueEl: HTMLElement;
};

/**
 * Host-agnostic widget that paints {@link Sample}s. Mount {@link element}
 * anywhere; the view drives its own throttled repaint. Compact is the floating
 * HUD; full is the checkbox list that chooses what compact shows. Styles are
 * not injected here. Call `injectStyles()` or use `mountPerfHud`.
 */
class PerformanceView {
  readonly element: HTMLDivElement;
  readonly settings: HudSettings;
  readonly theme: HudTheme;

  private readonly ownsTheme: boolean;
  private readonly unsubscribeTheme: () => void;
  private readonly monitor: PerformanceMonitor;
  private readonly minIntervalMs: number;
  private mode: PerformanceViewMode;
  private readonly graphValueEls = new Map<TimingMetric, HTMLElement>();
  private readonly graphCanvases = new Map<TimingMetric, GraphCanvas>();
  private readonly graphCheckboxes = new Map<TimingMetric, HTMLInputElement>();
  private readonly statValueEls = new Map<BudgetKey, HTMLElement>();
  private readonly statCheckboxes = new Map<BudgetKey, HTMLInputElement>();
  private infoCheckbox!: HTMLInputElement;
  private readonly themeRadios = new Map<ThemeMode, HTMLButtonElement>();
  private footerThreeEl!: HTMLElement;
  private footerHardwareEl!: HTMLElement;
  private footerBackendEl!: HTMLElement;
  private footerGpuEl!: HTMLElement;
  private lastEnvironmentKey = "";
  private hudGraphsEl!: HTMLElement;
  private hudGridEl!: HTMLElement;
  private readonly hudGraphs = new Map<TimingMetric, HudGraph>();
  private readonly hudNumberEls = new Map<BudgetKey, HTMLElement>();
  private budgets: ResolvedBudgets;
  private rafId: number | null = null;
  private lastPaintAt = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribe: () => void;
  private costsOpen = false;
  private costGroup: CostGroup = "meshes";
  private costSort: CostSort = "calls";
  private lastCostsAt = -Infinity;
  private costsBodyEl!: HTMLElement;
  private costsListEl!: HTMLElement;
  private readonly costGroupRadios = new Map<CostGroup, HTMLButtonElement>();
  private readonly costSortButtons = new Map<CostSort, HTMLButtonElement>();

  constructor(options: PerformanceViewOptions) {
    this.monitor = options.monitor;
    this.settings = options.settings ?? new HudSettings();
    this.ownsTheme = !options.theme;
    this.theme = options.theme ?? new HudTheme();
    // The panel's pick, restored from storage, sits on top of the consumer's mode.
    this.theme.setOverride(this.settings.theme);
    this.mode = options.mode ?? "full";
    this.minIntervalMs = 1000 / (options.refreshHz ?? 10);
    this.budgets = resolveBudgets(options.budgets);
    this.element = document.createElement("div");
    this.element.className = "perf-monitor";
    this.applyModeClass();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvases());
    this.build();
    this.applyInfoClass();
    this.rebuildHud();
    this.onThemeChanged();
    this.unsubscribe = this.settings.subscribe(() => this.onSelectionChanged());
    this.unsubscribeTheme = this.theme.subscribe(() => this.onThemeChanged());
  }

  start() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setMode(mode: PerformanceViewMode) {
    if (mode === this.mode) {
      return;
    }

    this.mode = mode;
    this.applyModeClass();
    this.resizeCanvases();
  }

  getMode() {
    return this.mode;
  }

  /** Replace the budgets; `false` turns them all off. Applies on the next paint. */
  setBudgets(budgets: Budgets | false | undefined) {
    this.budgets = resolveBudgets(budgets);
    this.applyBudgetTitles();
  }

  dispose() {
    this.stop();
    this.unsubscribe();
    this.unsubscribeTheme();

    if (this.ownsTheme) {
      this.theme.dispose();
    }

    this.resizeObserver.disconnect();
    this.element.remove();
  }

  private frame = (now: number) => {
    this.rafId = requestAnimationFrame(this.frame);

    if (now - this.lastPaintAt < this.minIntervalMs) {
      return;
    }

    this.lastPaintAt = now;
    this.render();
  };

  private render() {
    const sample = this.monitor.getSample();

    if (this.mode === "compact") {
      this.renderHud(sample);

      if (this.settings.info) {
        this.renderFooter();
      }

      return;
    }

    for (const config of TIMINGS) {
      this.paintGraph(
        config,
        sample,
        this.graphValueEls.get(config.metric)!,
        this.graphCanvases.get(config.metric)!,
        "unavailable",
      );
    }

    const stats = this.monitor.getFrameStats();

    for (const config of NUMBERS) {
      this.paintNumber(config, this.statValueEls.get(config.key)!, sample, stats);
    }

    if (this.costsOpen && performance.now() - this.lastCostsAt >= COSTS_INTERVAL_MS) {
      this.renderCosts();
    }

    this.renderFooter();
  }

  private renderCosts() {
    this.lastCostsAt = performance.now();
    const cost = this.monitor.getSceneCost();

    if (!cost) {
      this.costsListEl.replaceChildren(this.costsNote("No scene rendered yet."));

      return;
    }

    const entries = [...(this.costGroup === "meshes" ? cost.meshes : cost.materials)];

    if (this.costSort === "triangles") {
      entries.sort((a, b) => b.triangles - a.triangles || b.calls - a.calls);
    }

    if (entries.length === 0) {
      this.costsListEl.replaceChildren(this.costsNote("Nothing drawn."));

      return;
    }

    const rows = entries.slice(0, COSTS_ROWS).map((entry) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "perf-monitor__cost";
      row.title = costTitle(entry);

      const name = document.createElement("span");
      name.className = "perf-monitor__cost-name";
      name.textContent = entry.label;

      const copies = copiesOf(entry);

      if (copies) {
        const suffix = document.createElement("span");
        suffix.className = "perf-monitor__cost-copies";
        suffix.textContent = ` ${copies}`;
        name.append(suffix);
      }

      const calls = document.createElement("span");
      calls.className = "perf-monitor__cost-value";
      calls.textContent = formatCount(entry.calls);

      const triangles = document.createElement("span");
      triangles.className = "perf-monitor__cost-value";
      triangles.textContent = formatCount(entry.triangles);

      row.append(name, calls, triangles);
      row.addEventListener("click", () => {
        // oxlint-disable-next-line no-console -- handing the objects to devtools is the feature
        console.log(`three-meter: ${entry.label}`, entry.objects);
      });

      return row;
    });

    this.costsListEl.replaceChildren(...rows);
  }

  private costsNote(text: string) {
    const note = document.createElement("div");
    note.className = "perf-monitor__costs-note";
    note.textContent = text;

    return note;
  }

  /** The monitor caches the environment once its backend settles; until then this re-reads. */
  private renderFooter() {
    const environment = this.monitor.getEnvironment();
    const three = environment.three ? `three r${environment.three}` : "";
    const backend = backendLabel(environment);
    const gpu = environment.gpu ?? "";
    const key = `${three}\n${backend}\n${gpu}`;

    if (key === this.lastEnvironmentKey) {
      return;
    }

    this.lastEnvironmentKey = key;
    this.footerThreeEl.textContent = three;
    this.footerBackendEl.textContent = backend;
    this.footerBackendEl.hidden = backend === "";
    this.footerBackendEl.title = environment.fallback
      ? "WebGPURenderer couldn't get WebGPU and fell back to WebGL2"
      : "";
    this.footerBackendEl.classList.toggle("is-fallback", environment.fallback);
    this.footerGpuEl.textContent = gpu;
    this.footerGpuEl.title = gpu;
    this.footerHardwareEl.hidden = backend === "" && gpu === "";
  }

  private renderHud(sample: Sample) {
    const stats = this.hudNumberEls.size > 0 ? this.monitor.getFrameStats() : null;

    for (const [key, element] of this.hudNumberEls) {
      const config = NUMBER_BY_KEY.get(key);

      if (config && stats) {
        this.paintNumber(config, element, sample, stats);
      }
    }

    for (const [metric, graph] of this.hudGraphs) {
      const config = TIMINGS.find((timing) => timing.metric === metric)!;
      this.paintGraph(config, sample, graph.valueEl, graph, "—");
    }
  }

  private paintNumber(
    config: NumberConfig,
    element: HTMLElement,
    sample: Sample,
    stats: FrameStats,
  ) {
    const value = config.value(sample, stats);
    element.textContent = value === null ? "—" : config.format(value);
    element.classList.toggle("is-over", isOverBudget(this.budgets, config.key, value));
  }

  /** Value and sparkline, with the budget line drawn once the series reaches it. */
  private paintGraph(
    config: TimingConfig,
    sample: Sample,
    valueEl: HTMLElement,
    graph: GraphCanvas,
    missing: string,
  ) {
    const value = timingValue(sample, config.metric);
    const available = isTimingAvailable(sample, config.metric);
    const limit = this.budgets.limits[config.metric];

    valueEl.textContent = available
      ? this.formatTiming(config, readTiming(sample, config.metric))
      : missing;
    valueEl.classList.toggle("is-over", isOverBudget(this.budgets, config.metric, value));

    drawSparkline(
      graph.ctx,
      graph.width,
      graph.height,
      available ? this.monitor.getHistory(config.metric) : [],
      config.style[this.theme.resolved],
      limit === undefined ? undefined : { color: GUIDE_COLOR[this.theme.resolved], value: limit },
    );
  }

  /** Each value's tooltip names its budget, so amber explains itself. */
  private applyBudgetTitles() {
    for (const [key, element] of this.statValueEls) {
      element.title = budgetTitle(this.budgets, key);
    }

    for (const [key, element] of this.hudNumberEls) {
      element.title = budgetTitle(this.budgets, key);
    }

    for (const [metric, element] of this.graphValueEls) {
      element.title = budgetTitle(this.budgets, metric);
    }

    for (const [metric, graph] of this.hudGraphs) {
      graph.valueEl.title = budgetTitle(this.budgets, metric);
    }
  }

  private formatTiming(config: TimingConfig, value: number) {
    return `${config.format(value)}${config.unit ? ` ${config.unit}` : ""}`;
  }

  private build() {
    const hud = document.createElement("div");
    hud.className = "perf-monitor__hud";
    this.hudGraphsEl = document.createElement("div");
    this.hudGraphsEl.className = "perf-monitor__hud-graphs";
    this.hudGridEl = document.createElement("div");
    this.hudGridEl.className = "perf-monitor__hud-grid";
    hud.append(this.hudGraphsEl, this.hudGridEl);

    // Option rows read icon, label, control; the stat rows below keep the
    // checkbox first, so the two groups scan differently on purpose.
    const options = document.createElement("div");
    options.className = "perf-monitor__section perf-monitor__options";

    const themeRow = document.createElement("div");
    themeRow.className = "perf-monitor__row perf-monitor__row--static";

    const themeLabel = document.createElement("span");
    themeLabel.className = "perf-monitor__label";
    themeLabel.textContent = "theme";

    const segment = document.createElement("div");
    segment.className = "perf-monitor__segment";
    segment.setAttribute("role", "radiogroup");
    segment.setAttribute("aria-label", "Panel theme");

    for (const option of THEME_OPTIONS) {
      const radio = document.createElement("button");
      radio.type = "button";
      radio.className = "perf-monitor__segment-option";
      radio.setAttribute("role", "radio");
      radio.setAttribute("aria-checked", "false");
      radio.setAttribute("aria-label", option.label);
      radio.title = option.label;
      radio.append(createIcon(option.icon, "perf-monitor__icon"));
      radio.addEventListener("click", () => this.settings.setTheme(option.mode));
      this.themeRadios.set(option.mode, radio);
      segment.append(radio);
    }

    themeRow.append(createIcon("contrast", "perf-monitor__icon"), themeLabel, segment);

    // View-local, not a setting: it's a way to learn the panel, not a preference.
    const explainRow = document.createElement("label");
    explainRow.className = "perf-monitor__row";

    const explainCheckbox = this.buildCheckbox(false, "Explain each metric", (on) =>
      this.element.classList.toggle("perf-monitor--explain", on),
    );

    const explainLabel = document.createElement("span");
    explainLabel.className = "perf-monitor__label";
    explainLabel.textContent = "explain metrics";

    explainRow.append(createIcon("help", "perf-monitor__icon"), explainLabel, explainCheckbox);
    // Dim on leave is a disc on the floating HUD (`mountPerfHud`), beside drag and expand.
    options.append(themeRow, explainRow, this.buildReportRow());

    const graphs = document.createElement("div");
    graphs.className = "perf-monitor__graphs";

    for (const config of TIMINGS) {
      const graph = document.createElement("div");
      graph.className = "perf-monitor__graph";

      const canvas = document.createElement("canvas");
      canvas.className = "perf-monitor__canvas";

      // The whole overlay is the label, so a click anywhere on the graph toggles it.
      const overlay = document.createElement("label");
      overlay.className = "perf-monitor__graph-overlay perf-monitor__graph-overlay--toggle";

      const head = document.createElement("span");
      head.className = "perf-monitor__graph-head";

      const checkbox = this.buildCheckbox(
        this.settings.isGraphEnabled(config.metric),
        `Show ${config.label} graph in HUD`,
        (on) => this.settings.setGraphEnabled(config.metric, on),
      );
      this.graphCheckboxes.set(config.metric, checkbox);

      const label = document.createElement("span");
      label.className = "perf-monitor__graph-label";
      label.textContent = config.label;
      label.title = METRIC_HELP[config.metric] ?? "";

      const value = document.createElement("span");
      value.className = "perf-monitor__graph-value";
      value.textContent = "—";
      this.graphValueEls.set(config.metric, value);

      const tail = document.createElement("span");
      tail.className = "perf-monitor__graph-head";
      tail.append(value, checkbox);

      head.append(createIcon(config.icon, "perf-monitor__icon"), label);
      overlay.append(head, tail);
      graph.append(canvas, overlay);
      graphs.append(graph);

      const ctx = canvas.getContext("2d");

      if (ctx) {
        this.graphCanvases.set(config.metric, { canvas, ctx, height: 0, width: 0 });
        this.resizeObserver.observe(graph);
      }
    }

    const stats = document.createElement("div");
    stats.className = "perf-monitor__section";

    for (const config of NUMBERS) {
      const rowEl = document.createElement("label");
      rowEl.className = "perf-monitor__row";

      const checkbox = this.buildCheckbox(
        this.settings.isNumberEnabled(config.key),
        `Show ${config.label} in HUD`,
        (on) => this.settings.setNumberEnabled(config.key, on),
      );
      this.statCheckboxes.set(config.key, checkbox);

      const help = METRIC_HELP[config.key] ?? "";

      const label = document.createElement("span");
      label.className = "perf-monitor__label";
      label.textContent = config.label;
      label.title = help;

      const value = document.createElement("span");
      value.className = "perf-monitor__value";
      value.textContent = "—";
      this.statValueEls.set(config.key, value);

      const hint = document.createElement("span");
      hint.className = "perf-monitor__hint";
      hint.textContent = help;

      rowEl.append(createIcon(config.icon, "perf-monitor__icon"), label, value, checkbox, hint);
      stats.append(rowEl);
    }

    // Icon, rows, checkbox like the stat rows; icon and checkbox hide in compact, the rows don't.
    const footer = document.createElement("div");
    footer.className = "perf-monitor__footer";

    this.infoCheckbox = this.buildCheckbox(
      this.settings.info,
      "Show version and environment in HUD",
      (on) => this.settings.setInfo(on),
    );

    const footerBody = document.createElement("div");
    footerBody.className = "perf-monitor__footer-body";

    // Software on the first row, hardware on the second.
    const softwareRow = document.createElement("div");
    softwareRow.className = "perf-monitor__footer-row";

    const release = document.createElement("a");
    release.className = "perf-monitor__link";
    release.href = RELEASE_URL;
    release.target = "_blank";
    release.rel = "noopener noreferrer";
    release.title = `Release notes for v${version}`;
    release.textContent = `three-meter v${version}`;

    this.footerThreeEl = document.createElement("span");
    softwareRow.append(release, this.footerThreeEl);

    this.footerHardwareEl = document.createElement("div");
    this.footerHardwareEl.className = "perf-monitor__footer-row";
    this.footerHardwareEl.hidden = true;

    this.footerBackendEl = document.createElement("span");
    this.footerBackendEl.className = "perf-monitor__badge";

    this.footerGpuEl = document.createElement("span");
    this.footerGpuEl.className = "perf-monitor__footer-gpu";

    this.footerHardwareEl.append(this.footerBackendEl, this.footerGpuEl);
    footerBody.append(softwareRow, this.footerHardwareEl);
    footer.append(createIcon("info", "perf-monitor__icon"), footerBody, this.infoCheckbox);

    this.element.append(hud, options, graphs, stats, this.buildCosts(), footer);
  }

  private rebuildHud() {
    const { selection } = this.settings;

    for (const graph of this.hudGraphs.values()) {
      this.resizeObserver.unobserve(graph.canvas.parentElement ?? graph.canvas);
    }

    this.hudGraphs.clear();
    this.hudNumberEls.clear();
    this.hudGraphsEl.replaceChildren();
    this.hudGridEl.replaceChildren();

    for (const config of TIMINGS) {
      if (!selection.graphs.has(config.metric)) {
        continue;
      }

      const row = document.createElement("div");
      row.className = "perf-monitor__hud-graph";

      const canvas = document.createElement("canvas");
      canvas.className = "perf-monitor__canvas";

      const overlay = document.createElement("div");
      overlay.className = "perf-monitor__graph-overlay";

      const label = document.createElement("span");
      label.className = "perf-monitor__graph-label";
      label.textContent = config.label;
      label.title = METRIC_HELP[config.metric] ?? "";

      const head = document.createElement("span");
      head.className = "perf-monitor__graph-head";
      head.append(createIcon(config.icon, "perf-monitor__icon"), label);

      const value = document.createElement("span");
      value.className = "perf-monitor__graph-value";
      value.textContent = "—";

      overlay.append(head, value);
      row.append(canvas, overlay);
      this.hudGraphsEl.append(row);

      const ctx = canvas.getContext("2d");

      if (ctx) {
        this.hudGraphs.set(config.metric, { canvas, ctx, height: 0, valueEl: value, width: 0 });
        this.resizeObserver.observe(row);
      }
    }

    for (const config of NUMBERS) {
      if (!selection.numbers.has(config.key)) {
        continue;
      }

      const item = document.createElement("div");
      item.className = "perf-monitor__hud-item";

      const label = document.createElement("span");
      label.className = "perf-monitor__hud-label";
      label.title = METRIC_HELP[config.key] ?? "";
      label.append(createIcon(config.icon, "perf-monitor__icon"), config.label);

      const value = document.createElement("span");
      value.className = "perf-monitor__hud-value";
      value.textContent = "—";

      item.append(label, value);
      this.hudGridEl.append(item);
      this.hudNumberEls.set(config.key, value);
    }

    this.applyBudgetTitles();
    this.resizeCanvases();
  }

  private onSelectionChanged() {
    for (const [metric, checkbox] of this.graphCheckboxes) {
      checkbox.checked = this.settings.isGraphEnabled(metric);
    }

    for (const [key, checkbox] of this.statCheckboxes) {
      checkbox.checked = this.settings.isNumberEnabled(key);
    }

    this.infoCheckbox.checked = this.settings.info;
    this.applyInfoClass();
    this.theme.setOverride(this.settings.theme);
    this.rebuildHud();
  }

  /** Repaint the palette and mark the radio matching what applies (pick, else consumer mode). */
  private onThemeChanged() {
    applyTheme(this.element, this.theme);

    for (const [mode, radio] of this.themeRadios) {
      radio.setAttribute("aria-checked", String(mode === this.theme.effective));
    }
  }

  /** "top costs": a toggle row, then meshes / materials and a sortable top five. */
  private buildCosts() {
    const section = document.createElement("div");
    section.className = "perf-monitor__section perf-monitor__costs";

    const toggleRow = document.createElement("label");
    toggleRow.className = "perf-monitor__row";
    toggleRow.title = COSTS_HELP;

    const label = document.createElement("span");
    label.className = "perf-monitor__label";
    label.textContent = "top costs";

    const checkbox = this.buildCheckbox(false, "Show the scene's biggest draw costs", (on) => {
      this.costsOpen = on;
      this.costsBodyEl.hidden = !on;

      if (on) {
        this.renderCosts();
      }
    });

    toggleRow.append(createIcon("flame", "perf-monitor__icon"), label, checkbox);

    this.costsBodyEl = document.createElement("div");
    this.costsBodyEl.className = "perf-monitor__costs-body";
    this.costsBodyEl.hidden = true;

    const head = document.createElement("div");
    head.className = "perf-monitor__cost perf-monitor__cost--head";

    const segment = document.createElement("div");
    segment.className = "perf-monitor__segment";
    segment.setAttribute("role", "radiogroup");
    segment.setAttribute("aria-label", "Group costs by");

    for (const option of COST_GROUPS) {
      const radio = document.createElement("button");
      radio.type = "button";
      radio.className = "perf-monitor__segment-option perf-monitor__segment-option--text";
      radio.setAttribute("role", "radio");
      radio.setAttribute("aria-checked", String(option.group === this.costGroup));
      radio.textContent = option.label;
      radio.addEventListener("click", () => {
        this.costGroup = option.group;

        for (const [group, button] of this.costGroupRadios) {
          button.setAttribute("aria-checked", String(group === option.group));
        }

        this.renderCosts();
      });
      this.costGroupRadios.set(option.group, radio);
      segment.append(radio);
    }

    head.append(segment);

    for (const sort of ["calls", "triangles"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "perf-monitor__cost-sort";
      button.textContent = sort === "calls" ? "calls" : "tris";
      button.title = `Sort by ${sort === "calls" ? "draw calls" : "triangles"}`;
      button.setAttribute("aria-pressed", String(sort === this.costSort));
      button.addEventListener("click", () => {
        this.costSort = sort;

        for (const [key, other] of this.costSortButtons) {
          other.setAttribute("aria-pressed", String(key === sort));
        }

        this.renderCosts();
      });
      this.costSortButtons.set(sort, button);
      head.append(button);
    }

    this.costsListEl = document.createElement("div");
    this.costsListEl.className = "perf-monitor__costs-list";

    const hint = document.createElement("span");
    hint.className = "perf-monitor__hint";
    hint.textContent = COSTS_HELP;

    this.costsBodyEl.append(head, this.costsListEl, hint);
    section.append(toggleRow, this.costsBodyEl);

    return section;
  }

  private buildReportRow() {
    const row = document.createElement("div");
    row.className = "perf-monitor__row perf-monitor__row--static";

    const label = document.createElement("span");
    label.className = "perf-monitor__label";
    label.textContent = "report";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "perf-monitor__button";
    button.title = "Copy versions, GPU and current metrics as Markdown for a bug report";
    button.textContent = "copy";

    let resetTimer = 0;

    const flash = (text: string) => {
      button.textContent = text;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.textContent = "copy";
      }, COPY_FEEDBACK_MS);
    };

    button.addEventListener("click", () => {
      void copyText(formatReport(this.monitor)).then((copied) =>
        flash(copied ? "copied" : "failed"),
      );
    });

    row.append(createIcon("clipboard", "perf-monitor__icon"), label, button);

    return row;
  }

  private buildCheckbox(checked: boolean, title: string, onChange: (enabled: boolean) => void) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "perf-monitor__checkbox";
    checkbox.checked = checked;
    checkbox.title = title;
    checkbox.setAttribute("aria-label", title);
    checkbox.addEventListener("change", () => onChange(checkbox.checked));

    return checkbox;
  }

  private applyInfoClass() {
    this.element.classList.toggle("perf-monitor--info", this.settings.info);
  }

  private applyModeClass() {
    this.element.classList.toggle("perf-monitor--compact", this.mode === "compact");
    this.element.classList.toggle("perf-monitor--full", this.mode === "full");
  }

  private resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;

    const sizeAll = (graphs: Iterable<GraphCanvas>) => {
      for (const graph of graphs) {
        const { canvas, ctx } = graph;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (width === 0 || height === 0) {
          continue;
        }

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        graph.width = width;
        graph.height = height;
      }
    };

    sizeAll(this.graphCanvases.values());
    sizeAll(this.hudGraphs.values());
  }
}

export { PerformanceView };
export type { PerformanceViewMode, PerformanceViewOptions };
