/**
 * Which metrics the compact HUD shows, whether it shows the environment
 * footer, the dim-on-leave toggle, and the theme
 * the person using the HUD picked in the panel (`null` until they pick one,
 * so the consumer's `theme` option applies). One instance per HUD; the
 * full-mode controls and the compact card stay in sync through it. Persists
 * to `localStorage` under `storageKey` (pass `null` to keep it in memory only).
 */
import type { TimingMetric } from "../core/types.ts";
import { isThemeMode, type ThemeMode } from "./theme.ts";

type HudSelection = {
  dim: boolean;
  graphs: ReadonlySet<TimingMetric>;
  /** Version, three revision, backend and GPU footer in the compact HUD. */
  info: boolean;
  numbers: ReadonlySet<string>;
  theme: ThemeMode | null;
};

type HudDefaults = {
  dim?: boolean;
  graphs?: readonly TimingMetric[];
  info?: boolean;
  numbers?: readonly string[];
};

type HudSettingsOptions = {
  /** localStorage key. Default `three-meter`; `null` disables persistence. */
  storageKey?: string | null;
  /** What a first visit shows. */
  defaults?: HudDefaults;
};

type MutableSelection = {
  dim: boolean;
  graphs: Set<TimingMetric>;
  info: boolean;
  numbers: Set<string>;
  theme: ThemeMode | null;
};

const DEFAULT_STORAGE_KEY = "three-meter";
const DEFAULT_DIM = false;
const DEFAULT_INFO = false;
const DEFAULT_NUMBERS: readonly string[] = ["fps", "calls", "cpu", "gpu"];
const DEFAULT_GRAPHS: readonly TimingMetric[] = [];
const TIMING_METRICS = new Set<TimingMetric>(["fps", "cpu", "gpu"]);

const isTimingMetric = (value: string): value is TimingMetric =>
  TIMING_METRICS.has(value as TimingMetric);

class HudSettings {
  private readonly storageKey: string | null;
  private readonly defaults: Required<HudDefaults>;
  private readonly listeners = new Set<() => void>();
  private readonly state: MutableSelection;

  constructor(options: HudSettingsOptions = {}) {
    this.storageKey = options.storageKey === undefined ? DEFAULT_STORAGE_KEY : options.storageKey;
    this.defaults = {
      dim: options.defaults?.dim ?? DEFAULT_DIM,
      graphs: options.defaults?.graphs ?? DEFAULT_GRAPHS,
      info: options.defaults?.info ?? DEFAULT_INFO,
      numbers: options.defaults?.numbers ?? DEFAULT_NUMBERS,
    };
    this.state = this.load();
  }

  get selection(): HudSelection {
    return this.state;
  }

  get dim() {
    return this.state.dim;
  }

  setDim(enabled: boolean) {
    this.state.dim = enabled;
    this.persistAndNotify();
  }

  get info() {
    return this.state.info;
  }

  setInfo(enabled: boolean) {
    this.state.info = enabled;
    this.persistAndNotify();
  }

  /** The user's pick in the panel; `null` means none, so the consumer's option applies. */
  get theme() {
    return this.state.theme;
  }

  setTheme(mode: ThemeMode | null) {
    this.state.theme = mode;
    this.persistAndNotify();
  }

  isNumberEnabled(key: string) {
    return this.state.numbers.has(key);
  }

  isGraphEnabled(metric: TimingMetric) {
    return this.state.graphs.has(metric);
  }

  setNumberEnabled(key: string, enabled: boolean) {
    if (enabled) {
      this.state.numbers.add(key);
    } else {
      this.state.numbers.delete(key);
    }

    this.persistAndNotify();
  }

  setGraphEnabled(metric: TimingMetric, enabled: boolean) {
    if (enabled) {
      this.state.graphs.add(metric);
    } else {
      this.state.graphs.delete(metric);
    }

    this.persistAndNotify();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private load(): MutableSelection {
    const fallback = (): MutableSelection => ({
      dim: this.defaults.dim,
      graphs: new Set(this.defaults.graphs),
      info: this.defaults.info,
      numbers: new Set(this.defaults.numbers),
      theme: null,
    });

    if (this.storageKey === null) {
      return fallback();
    }

    try {
      const raw = localStorage.getItem(this.storageKey);

      if (!raw) {
        return fallback();
      }

      const parsed = JSON.parse(raw) as {
        dim?: boolean;
        graphs?: string[];
        info?: boolean;
        numbers?: string[];
        theme?: unknown;
      };

      return {
        dim: parsed.dim ?? this.defaults.dim,
        graphs: new Set((parsed.graphs ?? this.defaults.graphs).filter(isTimingMetric)),
        info: parsed.info ?? this.defaults.info,
        numbers: new Set(parsed.numbers ?? this.defaults.numbers),
        theme: isThemeMode(parsed.theme) ? parsed.theme : null,
      };
    } catch {
      // Malformed or unavailable storage → defaults.
      return fallback();
    }
  }

  private persistAndNotify() {
    if (this.storageKey !== null) {
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({
            dim: this.state.dim,
            graphs: [...this.state.graphs],
            info: this.state.info,
            numbers: [...this.state.numbers],
            // Omitted while null: JSON.stringify drops undefined.
            theme: this.state.theme ?? undefined,
          }),
        );
      } catch {
        // In-memory selection still drives the live views.
      }
    }

    for (const listener of this.listeners) {
      listener();
    }
  }
}

export { DEFAULT_STORAGE_KEY, HudSettings };
export type { HudDefaults, HudSelection, HudSettingsOptions };
