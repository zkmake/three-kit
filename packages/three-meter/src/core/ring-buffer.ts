/**
 * Fixed-capacity numeric ring buffer. Backs the per-frame timing history the
 * view reads to draw sparklines. Push is O(1); `toArray()` returns values in
 * chronological (oldest → newest) order.
 */
class RingBuffer {
  private readonly data: Float32Array;
  private readonly capacity: number;
  private head = 0;
  private count = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity);
  }

  push(value: number) {
    this.data[this.head] = value;
    this.head = (this.head + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count += 1;
    }
  }

  /** Values oldest → newest. Length grows up to capacity as samples accumulate. */
  toArray(): number[] {
    const out = Array.from<number>({ length: this.count });
    const start = (this.head - this.count + this.capacity) % this.capacity;

    for (let index = 0; index < this.count; index += 1) {
      out[index] = this.data[(start + index) % this.capacity]!;
    }

    return out;
  }

  clear() {
    this.head = 0;
    this.count = 0;
  }
}

export { RingBuffer };
