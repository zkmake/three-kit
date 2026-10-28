import { describe, expect, test } from "vitest";

import { count, rank, type SearchEntry, stem, words } from "./rank.ts";

const ENTRIES: SearchEntry[] = [
  { kind: "action", label: "Switch to dark theme", words: "theme night" },
  { kind: "action", label: "Copy link to this page", words: "share url" },
  {
    kind: "package",
    label: "three-meter",
    detail: "See what every frame costs",
    words: "fps gpu hud",
  },
  { kind: "package", label: "three-audit", detail: "Catch broken geometry", words: "z-fighting" },
  {
    kind: "section",
    label: "From the command line",
    detail: "three-audit",
    href: "/three-kit/three-audit/#from-the-command-line",
    words: "three-audit installAuditHelpers --gap",
  },
  { kind: "page", label: "three-meter demo", href: "/three-kit/three-meter/" },
  { kind: "link", label: "@zkmake/three-meter on npm", href: "https://www.npmjs.com/package/x" },
];

const labels = (query: string) =>
  rank(ENTRIES, query).map((group) => [group.value, group.items.map((entry) => entry.label)]);

describe("words", () => {
  test("keep dashed, dotted and camelCase names whole and split", () => {
    expect(words("three-meter three.js installAuditHelpers")).toEqual([
      "three-meter",
      "three",
      "meter",
      "three.js",
      "three",
      "js",
      "installaudithelpers",
      "install",
      "audit",
      "helpers",
    ]);
  });

  test("stem drops plural and -ing endings on longer words", () => {
    expect([stem("batches"), stem("loading"), stem("gpus")]).toEqual(["batch", "load", "gpus"]);
  });
});

describe("rank", () => {
  test("nothing typed: commands, then packages, then pages", () => {
    expect(labels("").map(([group]) => group)).toEqual(["commands", "packages", "pages"]);
  });

  test("a package name finds the package first", () => {
    expect(labels("meter")[0]).toEqual(["packages", ["three-meter"]]);
    expect(labels("three-meter")[0]).toEqual(["packages", ["three-meter"]]);
  });

  test("an API name finds the README section that mentions it", () => {
    expect(labels("installAuditHelpers")).toEqual([["docs", ["From the command line"]]]);
    expect(labels("audit helpers")[0]?.[1]).toContain("From the command line");
  });

  test("a package outranks its install command", () => {
    const entries: SearchEntry[] = [
      { kind: "action", label: "Copy install command: three-batch" },
      { kind: "package", label: "three-batch" },
    ];

    expect(rank(entries, "batch")[0]?.value).toBe("packages");
  });

  test("equal README sections keep the README's order", () => {
    const entries: SearchEntry[] = [
      { kind: "section", label: "Vanilla three", words: "mountPerfHud" },
      { kind: "section", label: "Options", words: "mountPerfHud" },
    ];

    expect(rank(entries, "mountPerfHud")[0]?.items.map((entry) => entry.label)).toEqual([
      "Vanilla three",
      "Options",
    ]);
  });

  test("every word must match", () => {
    expect(labels("meter zebra")).toEqual([]);
  });

  test("a leading > lists only commands", () => {
    expect(labels(">")).toEqual([["commands", ["Switch to dark theme", "Copy link to this page"]]]);
    expect(labels("> dark")).toEqual([["commands", ["Switch to dark theme"]]]);
  });

  test("count adds up the rows", () => {
    expect(count(rank(ENTRIES, "three"))).toBe(5);
  });
});
