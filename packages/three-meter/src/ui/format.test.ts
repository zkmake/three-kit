import { describe, expect, test } from "vitest";

import { formatCount } from "./format.ts";

describe("formatCount", () => {
  test("keeps counts exact while they fit six characters", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(243)).toBe("243");
    expect(formatCount(24_000)).toBe("24,000");
    expect(formatCount(99_999)).toBe("99,999");
  });

  test("goes compact from 100,000 with at most one decimal", () => {
    expect(formatCount(100_000)).toBe("100K");
    expect(formatCount(250_500)).toBe("250.5K");
    expect(formatCount(1_076_708)).toBe("1.1M");
    expect(formatCount(1_400_000)).toBe("1.4M");
    expect(formatCount(12_345_678)).toBe("12.3M");
    expect(formatCount(1_200_000_000)).toBe("1.2B");
  });

  test("never exceeds the compact column", () => {
    for (const value of [99_999, 100_000, 999_949, 999_999, 9_999_999, 99_999_999, 999_999_999]) {
      expect(formatCount(value).length).toBeLessThanOrEqual(6);
    }
  });
});
