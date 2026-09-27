/**
 * Number formatting for the card. Counts stay exact with thousands separators
 * while they fit the compact grid's 6ch value column (`99,999`), then switch
 * to compact notation (`250K`, `1.4M`, `12.3M`, `1.2B`) so a triangle count in
 * the millions can't run into the neighbouring label.
 */
const COMPACT_FROM = 100_000;

const exact = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const formatCount = (value: number) =>
  Math.abs(value) < COMPACT_FROM ? exact.format(value) : compact.format(value);

export { formatCount };
