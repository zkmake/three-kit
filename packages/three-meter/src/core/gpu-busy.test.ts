import { describe, expect, test } from "vitest";

import { latestFrameBusyMs, tapTimestampPool } from "./gpu-busy.ts";

const US = 1000n;
/** GPU clocks never read 0 (that's an unwritten query), so the rows start here. */
const BASE_US = 5_000_000n;

/** uid → offset, and the matching times (ns), from `[uid, beginMs, endMs]` rows. */
const queries = (rows: [string, number, number][]) => {
  const offsets = new Map<string, number>();
  const times = new BigUint64Array(rows.length * 2);

  rows.forEach(([uid, begin, end], index) => {
    offsets.set(uid, index * 2);
    times[index * 2] = (BASE_US + BigInt(Math.round(begin * 1000))) * US;
    times[index * 2 + 1] = (BASE_US + BigInt(Math.round(end * 1000))) * US;
  });

  return { offsets, times };
};

/** A stand-in for three's `WebGPUTimestampQueryPool`, shaped like 0.186. */
const fakePool = (rows: [string, number, number][]) => {
  const { offsets, times } = queries(rows);
  const pool = {
    queryOffsets: offsets,
    resultBuffer: { getMappedRange: () => times.buffer },
    async _resolveQueries() {
      const current = new Map(this.queryOffsets);
      this.queryOffsets.clear();
      this.resultBuffer.getMappedRange();

      return current.size;
    },
  };

  return pool;
};

describe("latestFrameBusyMs", () => {
  test("counts overlapping passes once", () => {
    const { offsets, times } = queries([
      ["r:1:0:f7", 0.2, 1.6],
      ["r:2:1:f7", 0.1, 1.5],
      ["r:3:2:f7", 0, 0.7],
      ["r:4:3:f7", 0.1, 0.8],
    ]);

    expect(latestFrameBusyMs(offsets, times)).toBeCloseTo(1.6, 6);
  });

  test("leaves out the idle gap between passes", () => {
    const { offsets, times } = queries([
      ["r:1:0:f3", 0, 1],
      ["r:2:0:f3", 4, 6],
    ]);

    expect(latestFrameBusyMs(offsets, times)).toBeCloseTo(3, 6);
  });

  test("reads only the newest frame", () => {
    const { offsets, times } = queries([
      ["r:1:0:f9", 0, 5],
      ["r:1:0:f10", 20, 21],
      ["r:2:0:f10", 20.5, 22],
    ]);

    expect(latestFrameBusyMs(offsets, times)).toBeCloseTo(2, 6);
  });

  test("skips unwritten queries and unknown uids", () => {
    const { offsets, times } = queries([
      ["r:1:0:f2", 1, 2],
      ["no-frame", 0, 50],
    ]);
    offsets.set("r:2:0:f2", times.length);

    expect(latestFrameBusyMs(offsets, times)).toBeCloseTo(1, 6);
    expect(latestFrameBusyMs(new Map(), times)).toBeNull();
  });
});

describe("tapTimestampPool", () => {
  test("hands over the busy time of each resolve once", async () => {
    const pool = fakePool([
      ["r:1:0:f1", 0, 1.5],
      ["r:2:0:f1", 0.2, 1.6],
    ]);
    const tap = tapTimestampPool(pool)!;

    expect(tap.take()).toBeNull();
    await pool._resolveQueries();
    expect(tap.take()).toBeCloseTo(1.6, 6);
    expect(tap.take()).toBeNull();
  });

  test("puts the pool's members back on detach", () => {
    const pool = fakePool([]);
    const { _resolveQueries: resolve } = pool;
    const { getMappedRange } = pool.resultBuffer;

    tapTimestampPool(pool)!.detach();

    expect(pool._resolveQueries).toBe(resolve);
    expect(pool.resultBuffer.getMappedRange).toBe(getMappedRange);
  });

  test("isn't a tap when the pool's shape is unknown", () => {
    expect(tapTimestampPool(null)).toBeNull();
    expect(tapTimestampPool({ queryOffsets: new Map() })).toBeNull();
  });
});
