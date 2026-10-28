import type { APIRoute } from "astro";

import { installCommands, LIBRARIES, type Library, REPO_URL } from "../libraries.ts";
import { url } from "../paths.ts";
import type { SearchEntry } from "../search/rank.ts";
import { PLUGIN, SKILLS } from "../skills.ts";

/**
 * ⌘K's index (`/three-kit/search.json`), fetched on the palette's first open: the pages, the
 * packages, every README section (found by the API names it mentions too), the agent skills with
 * their sections and references, and the links out.
 * Commands are the palette's own (src/search/palette.tsx).
 */

type Heading = { depth: number; slug: string; text: string };

const READMES = import.meta.glob<{ getHeadings: () => Heading[] }>(
  "../../../../packages/*/README.md",
  { eager: true },
);
const SOURCES = import.meta.glob<string>("../../../../packages/*/README.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

const readmeOf = (name: string) => `../../../../packages/${name}/README.md`;

/** A package's docs: its README, the package's page. */
const docsOf = (lib: Library) => url(`${lib.name}/`);

/** API-looking names in a stretch of README: inline code, and camelCase or PascalCase names. */
const apiNames = (text: string) => {
  const names = new Set<string>();

  for (const [, code] of text.matchAll(/`([^`\n]+)`/g)) {
    names.add(code!.replace(/[<>/{}();]/g, " ").trim());
  }

  for (const [name] of text.matchAll(/\b[a-zA-Z_$][\w$]*[a-z\d][A-Z][\w$]*\b/g)) {
    names.add(name);
  }

  return [...names].filter(Boolean).join(" ");
};

/**
 * Each `##` / `###` section's text, in order, outside code fences: what `getHeadings` lists, so the
 * two line up by index.
 */
const sectionTexts = (source: string) => {
  const sections: string[] = [];
  let fenced = false;

  for (const line of source.split("\n")) {
    if (line.startsWith("```")) {
      fenced = !fenced;
    }

    if (!fenced && /^#{2,3}\s/.test(line)) {
      sections.push("");
    } else if (sections.length > 0) {
      sections[sections.length - 1] += `${line}\n`;
    }
  }

  return sections;
};

const sections = (lib: Library): SearchEntry[] => {
  const headings = (READMES[readmeOf(lib.name)]?.getHeadings() ?? []).filter(
    ({ depth }) => depth === 2 || depth === 3,
  );
  const texts = sectionTexts(SOURCES[readmeOf(lib.name)] ?? "");
  let parent = "";

  return headings.map(({ depth, slug, text }, index) => {
    if (depth === 2) {
      parent = text;
    }

    return {
      kind: "section",
      icon: "section",
      label: text,
      detail: depth === 3 && parent ? `${lib.name} · ${parent}` : lib.name,
      href: `${docsOf(lib)}#${slug}`,
      words: `${lib.name} ${apiNames(texts[index] ?? "")}`,
    };
  });
};

const entries = (): SearchEntry[] => [
  {
    kind: "page",
    icon: "home",
    label: "three-kit",
    detail: "Home: every package",
    href: url(),
    words: "home landing start index packages",
  },
  ...LIBRARIES.filter((lib) => lib.demo).map((lib): SearchEntry => ({
    kind: "page",
    icon: "demo",
    label: `${lib.name} demo`,
    detail: lib.mediaLabel,
    href: url(`${lib.name}/demo/`),
    words: "live demo vanilla r3f react three fiber",
  })),
  ...LIBRARIES.map((lib): SearchEntry => ({
    kind: "page",
    icon: "docs",
    label: `${lib.name} docs`,
    detail: "README",
    href: docsOf(lib),
    words: "readme documentation api",
  })),
  {
    kind: "page",
    icon: "agent",
    label: "llms.txt",
    detail: "The docs as markdown, for coding agents",
    href: url("llms.txt"),
    words: "llms agents ai markdown claude codex",
  },
  ...LIBRARIES.map((lib): SearchEntry & { install: Record<string, string> } => ({
    kind: "package",
    icon: lib.name,
    label: lib.name,
    detail: lib.job,
    href: url(`${lib.name}/`),
    words: `@zkmake/${lib.name} ${lib.summary} ${lib.mediaLabel} ${lib.dev ? "dev tool" : "runtime ships"}`,
    install: installCommands(lib),
  })),
  ...LIBRARIES.flatMap(sections),
  {
    kind: "page",
    icon: "skills",
    label: "Agent skills",
    detail: "For any agent via npx skills, or as a Claude Code plugin",
    href: PLUGIN.href,
    words: `skills agents ai claude code codex cursor plugin marketplace npx skills.sh install ${SKILLS.map((skill) => skill.name).join(" ")}`,
  },
  ...SKILLS.map((skill): SearchEntry => ({
    kind: "skill",
    icon: "skill",
    label: skill.name,
    detail: skill.title,
    href: skill.href,
    words: `${skill.command} ${skill.description} skill agent`,
  })),
  ...SKILLS.flatMap((skill): SearchEntry[] => [
    ...skill.headings
      .filter(({ depth }) => depth === 2)
      .map(({ slug, text }): SearchEntry => ({
        kind: "section",
        icon: "section",
        label: text,
        detail: `${skill.name} skill`,
        href: `${skill.href}#${slug}`,
        words: `${skill.name} skill`,
      })),
    ...skill.references.map((reference): SearchEntry => ({
      kind: "section",
      icon: "docs",
      label: reference.title,
      detail: `${skill.name} skill · reference`,
      href: reference.href,
      words: `${skill.name} skill reference ${reference.summary}`,
    })),
  ]),
  {
    kind: "link",
    icon: "github",
    label: "GitHub",
    detail: "zkmake/three-kit",
    href: REPO_URL,
    words: "source repo code issues",
  },
  ...LIBRARIES.flatMap((lib): SearchEntry[] => [
    {
      kind: "link",
      icon: "npm",
      label: `@zkmake/${lib.name} on npm`,
      detail: `v${lib.version}`,
      href: `https://www.npmjs.com/package/@zkmake/${lib.name}`,
      words: "npm package registry install",
    },
    {
      kind: "link",
      icon: "changelog",
      label: `${lib.name} changelog`,
      detail: `v${lib.version}`,
      href: `${REPO_URL}/blob/main/packages/${lib.name}/CHANGELOG.md`,
      words: "changelog releases versions what's new",
    },
    {
      kind: "link",
      icon: "github",
      label: `${lib.name} source`,
      detail: `packages/${lib.name}`,
      href: `${REPO_URL}/tree/main/packages/${lib.name}`,
      words: "source code github",
    },
  ]),
];

export const GET: APIRoute = () =>
  new Response(JSON.stringify(entries()), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
