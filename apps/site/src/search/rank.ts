/**
 * ⌘K's matching, apart from the palette so it's tested without a browser and loads without the
 * entries: those come from `search.json` (`src/pages/search.json.ts`). Ported from zubin.dev's
 * palette, with the kit's own kinds.
 */

export type SearchKind = "action" | "page" | "package" | "skill" | "section" | "link";

export type SearchEntry = {
  kind: SearchKind;
  label: string;
  /** The line under it: a package's job, a section's package. */
  detail?: string;
  /** Where it goes: a site path, or a full URL for an outside link. */
  href?: string;
  /** An icon name from the palette's map. */
  icon?: string;
  /** More it's found by, never shown: summaries, the API names a README section mentions. */
  words?: string;
  /** A package's install command per package manager, for its "Copy install command". */
  install?: Record<string, string>;
};

export type SearchGroup = { value: string; items: SearchEntry[] };

/** Groups in the order they list when something is typed, before sorting by best match. */
const GROUPS: readonly { kind: SearchKind; name: string; limit: number }[] = [
  { kind: "action", name: "commands", limit: 10 },
  { kind: "package", name: "packages", limit: 8 },
  { kind: "skill", name: "skills", limit: 6 },
  { kind: "page", name: "pages", limit: 8 },
  { kind: "section", name: "docs", limit: 14 },
  { kind: "link", name: "elsewhere", limit: 8 },
];

/** Ties go to the broader thing: the package before its install command or a README section. */
const BROADER: Record<SearchKind, number> = {
  package: 0.6,
  action: 0.5,
  skill: 0.45,
  page: 0.3,
  link: 0.1,
  section: 0,
};

/** "batches" → "batch", "loading" → "load". */
export const stem = (word: string) =>
  word.length > 4 ? word.replace(/(ing|ies|es|s|ed)$/, "") : word;

/**
 * Words, lowercased, with dotted and dashed names kept whole as well as split: "three.js" and
 * "three-meter" match whole, and "meter" still finds three-meter. camelCase API names split too:
 * "installAuditHelpers" is found by "audit".
 */
export const words = (text: string) => {
  const out: string[] = [];

  for (const raw of text.split(/[^\p{L}\p{N}.\-_#]+/u)) {
    const whole = raw.replace(/^[.\-_]+|[.\-_]+$/g, "");

    if (!whole) {
      continue;
    }

    out.push(whole.toLowerCase());

    const parts = whole
      .replace(/([a-z\d])([A-Z])/g, "$1 $2")
      .split(/[.\-_ ]+/)
      .filter(Boolean);

    if (parts.length > 1) {
      out.push(...parts.map((part) => part.toLowerCase()));
    }
  }

  return out;
};

type Prepared = { entry: SearchEntry; label: string[]; rest: string[] };

const prepared = new WeakMap<readonly SearchEntry[], Prepared[]>();

function prepare(entries: readonly SearchEntry[]) {
  let list = prepared.get(entries);

  if (!list) {
    list = entries.map((entry) => ({
      entry,
      label: words(entry.label),
      rest: words(`${entry.detail ?? ""} ${entry.words ?? ""} ${entry.href ?? ""}`),
    }));
    prepared.set(entries, list);
  }

  return list;
}

/**
 * How well an entry matches every term, or 0 if one is missing: a whole word of the label counts
 * most, then the start of a label word, then the start of any of its other words. Broader things
 * and short labels win ties, except README sections, which keep the README's order (setup first).
 */
function score({ entry, label, rest }: Prepared, terms: readonly string[]) {
  let total = 0;

  for (const term of terms) {
    if (label.some((w) => w === term || stem(w) === term)) {
      total += 4;
    } else if (label.some((w) => w.startsWith(term))) {
      total += 3;
    } else if (rest.some((w) => w.startsWith(term) || stem(w) === term)) {
      total += 1;
    } else {
      return 0;
    }
  }

  return total + BROADER[entry.kind] - (entry.kind === "section" ? 0 : label.length / 100);
}

/**
 * The palette's list for a query: with nothing typed, a short start (commands, the packages, the
 * skills, the pages); otherwise every entry holding each word, grouped by kind, the best group first. A
 * leading ">" lists only commands, as in an editor's palette.
 */
export function rank(entries: readonly SearchEntry[], query: string): SearchGroup[] {
  const commandsOnly = query.trimStart().startsWith(">");
  const pool = commandsOnly ? entries.filter((e) => e.kind === "action") : entries;
  const terms = [...new Set(words(commandsOnly ? query.trimStart().slice(1) : query))]
    // A split name's parts are already among the words; matching on the whole is enough.
    .filter((term, _, all) => !all.some((other) => other !== term && words(other).includes(term)))
    .map(stem);

  if (terms.length === 0) {
    const start = (kind: SearchKind, n: number) => pool.filter((e) => e.kind === kind).slice(0, n);

    return [
      { value: "commands", items: start("action", commandsOnly ? 20 : 4) },
      { value: "packages", items: start("package", 10) },
      { value: "skills", items: start("skill", 6) },
      { value: "pages", items: start("page", 4) },
    ].filter((g) => g.items.length > 0);
  }

  const scored = prepare(pool)
    .map((p) => ({ entry: p.entry, score: score(p, terms) }))
    .filter((s) => s.score > 0);

  return GROUPS.map(({ kind, name, limit }) => {
    const hits = scored
      .filter((s) => s.entry.kind === kind)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { value: name, best: hits[0]?.score ?? 0, items: hits.map((h) => h.entry) };
  })
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.best - a.best)
    .map(({ value, items }) => ({ value, items }));
}

/** How many rows a ranked list holds. */
export const count = (groups: readonly SearchGroup[]) =>
  groups.reduce((n, g) => n + g.items.length, 0);
