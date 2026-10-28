/**
 * WebGPU frame time as the GPU was busy, not the sum of its passes.
 *
 * three's `resolveTimestampsAsync` adds up `end - start` of every pass in the
 * frame. Tile-based GPUs (Apple, most mobile) run passes overlapped, each
 * pass's span includes waiting on the ones before it, and the sum lands far
 * above the frame: keytar-hero's 15 passes read 14 ms, busy for 1.7 ms. Here
 * the raw begin/end pairs are merged, so overlap counts once.
 *
 * three throws those raw values away, so the tap wraps two members of its
 * timestamp pool (`_resolveQueries` for the uid → query offsets,
 * `resultBuffer.getMappedRange` for the times). Internal API: when the shape
 * isn't there, there's no tap and the caller keeps three's sum.
 */

/** The members of three's `WebGPUTimestampQueryPool` the tap reads. */
type TimestampPool = {
  queryOffsets: Map<string, number>;
  _resolveQueries: () => Promise<unknown>;
  resultBuffer: { getMappedRange: (offset?: number, size?: number) => ArrayBuffer } | null;
};

type PoolTap = {
  /** Busy ms of the newest frame resolved since the last take, else `null`. */
  take(): number | null;
  /** Puts the pool's own members back. */
  detach(): void;
};

const FRAME_UID = /:f(\d+)$/;

/**
 * The newest frame's busy ms: its passes' `[begin, end]` intervals (ns),
 * merged. `null` when no pass of it has a usable pair.
 */
const latestFrameBusyMs = (offsets: Map<string, number>, times: BigUint64Array): number | null => {
  let frame = -1;
  const byFrame = new Map<number, [bigint, bigint][]>();

  for (const [uid, offset] of offsets) {
    const match = FRAME_UID.exec(uid);
    const begin = times[offset];
    const end = times[offset + 1];

    // An unwritten query reads 0; a pass that didn't run can't count.
    if (!match || begin === undefined || end === undefined || begin === 0n || end < begin) {
      continue;
    }

    const id = Number(match[1]);
    const intervals = byFrame.get(id) ?? [];
    intervals.push([begin, end]);
    byFrame.set(id, intervals);
    frame = Math.max(frame, id);
  }

  const intervals = byFrame.get(frame);

  if (!intervals) {
    return null;
  }

  intervals.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  let busy = 0n;
  let [start, stop] = intervals[0]!;

  for (const [begin, end] of intervals.slice(1)) {
    if (begin <= stop) {
      stop = end > stop ? end : stop;
    } else {
      busy += stop - start;
      start = begin;
      stop = end;
    }
  }

  busy += stop - start;

  return Number(busy) / 1e6;
};

const isTimestampPool = (pool: unknown): pool is TimestampPool => {
  const candidate = pool as Partial<TimestampPool> | null | undefined;

  return (
    candidate?.queryOffsets instanceof Map &&
    typeof candidate._resolveQueries === "function" &&
    typeof candidate.resultBuffer?.getMappedRange === "function"
  );
};

/** Wraps a WebGPU render timestamp pool, or `null` when it isn't one. */
const tapTimestampPool = (pool: unknown): PoolTap | null => {
  if (!isTimestampPool(pool) || !pool.resultBuffer) {
    return null;
  }

  const buffer = pool.resultBuffer;
  const resolve = pool._resolveQueries;
  const getMappedRange = buffer.getMappedRange;
  let offsets: Map<string, number> | null = null;
  let latest: number | null = null;

  // three clears the offsets before it maps the buffer: copy them first. One
  // resolve is in flight at a time, so one copy is enough.
  pool._resolveQueries = function (this: TimestampPool) {
    offsets = new Map(this.queryOffsets);

    return resolve.call(this);
  };

  buffer.getMappedRange = function (this: unknown, offset?: number, size?: number) {
    const range = getMappedRange.call(this, offset, size);

    if (offsets) {
      try {
        latest = latestFrameBusyMs(offsets, new BigUint64Array(range)) ?? latest;
      } catch {
        // A shape this tap doesn't know: three's sum still stands.
      }

      offsets = null;
    }

    return range;
  };

  return {
    take() {
      const ms = latest;
      latest = null;

      return ms;
    },
    detach() {
      pool._resolveQueries = resolve;
      buffer.getMappedRange = getMappedRange;
    },
  };
};

export { latestFrameBusyMs, tapTimestampPool };
export type { PoolTap };
