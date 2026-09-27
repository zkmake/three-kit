import { describe, expect, test } from "vitest";

import { RingBuffer } from "./ring-buffer.ts";

describe("RingBuffer", () => {
  test("returns values oldest → newest before wrapping", () => {
    const buffer = new RingBuffer(4);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);

    expect(buffer.toArray()).toEqual([1, 2, 3]);
  });

  test("drops the oldest once full", () => {
    const buffer = new RingBuffer(3);

    for (const value of [1, 2, 3, 4, 5]) {
      buffer.push(value);
    }

    expect(buffer.toArray()).toEqual([3, 4, 5]);
  });

  test("clear empties without reallocating", () => {
    const buffer = new RingBuffer(2);
    buffer.push(1);
    buffer.clear();

    expect(buffer.toArray()).toEqual([]);
    buffer.push(7);
    expect(buffer.toArray()).toEqual([7]);
  });
});
