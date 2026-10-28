/**
 * Adaptive quality, as the HUD shows it: one line, `dpr 1.25 · adapting · shadows off`. The source
 * is `@zkmake/three-quality`'s controller (`adaptQuality`) or its React store (`qualityStore`),
 * read by shape like `AppBudgets`, so three-meter needs no dependency and the runtime package none
 * on this dev tool. Anything with a `state` of this shape works.
 */
type QualityReading = {
  /** The pixel ratio applied. */
  readonly dpr: number;
  /** What the controller is doing: `warming`, `adapting`, `steady`, `cpu-bound`, `pinned`. */
  readonly phase: string;
  /** 0 is the best rung. */
  readonly level: number;
  readonly levels: number;
  /** The app's tiers by name, `true` while on. */
  readonly tiers?: Readonly<Record<string, boolean>>;
  /** The last window's 90th-percentile frame, ms. */
  readonly p90Ms?: number | null;
  readonly targetFps?: number;
};

/** What the HUD's `quality` option takes. `state` is read on each repaint; `null` shows `—`. */
type QualitySource = { readonly state: QualityReading | null };

const ratio = (dpr: number) => Number(dpr.toFixed(2)).toString();

const tiersOff = (reading: QualityReading) =>
  Object.entries(reading.tiers ?? {})
    .filter(([, on]) => !on)
    .map(([name]) => name);

const formatQuality = (reading: QualityReading | null) => {
  if (!reading) {
    return "—";
  }

  const off = tiersOff(reading);

  return [`dpr ${ratio(reading.dpr)}`, reading.phase, off.length ? `${off.join(", ")} off` : ""]
    .filter(Boolean)
    .join(" · ");
};

const qualityTitle = (reading: QualityReading | null) => {
  if (!reading) {
    return "Adaptive quality: no controller mounted.";
  }

  const frame =
    typeof reading.p90Ms === "number"
      ? `; p90 frame ${reading.p90Ms.toFixed(1)} ms${reading.targetFps ? ` against ${(1000 / reading.targetFps).toFixed(1)} ms` : ""}`
      : "";

  return `Adaptive quality: level ${reading.level + 1} of ${reading.levels} (1 is the best)${frame}.`;
};

export { formatQuality, qualityTitle };
export type { QualityReading, QualitySource };
