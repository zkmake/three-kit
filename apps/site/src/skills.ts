/**
 * The Claude Code plugin's skills, read from `plugins/three-kit/` at build time: the skills page,
 * each skill's page (its `SKILL.md`) and its references' pages, ⌘K and the sitemap all list what's
 * there, so a new skill shows up with no extra step. Links between them are rewritten to these
 * pages by readme-links.ts.
 */
import type { MarkdownHeading, MarkdownInstance } from "astro";

import plugin from "../../../plugins/three-kit/.claude-plugin/plugin.json";
import { REPO_URL } from "./libraries.ts";
import { url } from "./paths.ts";

type SkillFrontmatter = {
  name: string;
  description: string;
  "argument-hint"?: string;
  "disable-model-invocation"?: boolean;
};

type Reference = {
  /** The file's name without `.md`: its page's slug. */
  slug: string;
  /** Its `#` heading. */
  title: string;
  /** Its opening paragraph, for the list on the skill's page. */
  summary: string;
  page: MarkdownInstance<Record<string, never>>;
  href: string;
};

type Skill = {
  name: string;
  /** What you type in Claude Code: `/three-kit:model-pass`. Other agents call it by name. */
  command: string;
  description: string;
  argumentHint: string | undefined;
  /** Runs only when typed, never on its own. */
  manual: boolean;
  /** Its `#` heading: "Model pass: one object at a time". */
  title: string;
  /** The steps of its loop, from the first bold `a → b → c` line: ["baseline", "remodel", …]. */
  loop: string[];
  page: MarkdownInstance<SkillFrontmatter>;
  headings: MarkdownHeading[];
  references: Reference[];
  href: string;
  source: string;
};

const ROOT = "../../../plugins/three-kit/skills/";

const SKILL_FILES = import.meta.glob<MarkdownInstance<SkillFrontmatter>>(
  "../../../plugins/three-kit/skills/*/SKILL.md",
  { eager: true },
);
const REFERENCE_FILES = import.meta.glob<MarkdownInstance<Record<string, never>>>(
  "../../../plugins/three-kit/skills/*/references/*.md",
  { eager: true },
);
const RAW = import.meta.glob<string>("../../../plugins/three-kit/skills/*/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

/** The first paragraph after the `#` heading, as plain text. */
const openingParagraph = (raw: string) =>
  (
    raw
      .replace(/^---[\s\S]*?---\s*/, "")
      .split(/\n\s*\n/)
      .find((block) => !block.startsWith("#")) ?? ""
  )
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The first bold run of steps joined by arrows: `**survey → rank → pass**`. */
const loopOf = (raw: string) =>
  (/\*\*([^*\n]+→[^*\n]+)\*\*/.exec(raw)?.[1] ?? "")
    .split("→")
    .map((step) => step.trim())
    .filter(Boolean);

const titleOf = (page: MarkdownInstance<Record<string, unknown>>, fallback: string) =>
  page.getHeadings().find((heading) => heading.depth === 1)?.text ?? fallback;

const SKILLS: readonly Skill[] = Object.entries(SKILL_FILES)
  .map(([path, page]) => {
    const name = page.frontmatter.name ?? path.split("/").at(-2)!;
    const references = Object.entries(REFERENCE_FILES)
      .filter(([file]) => file.startsWith(`${ROOT}${name}/references/`))
      .map(([file, reference]) => {
        const slug = file.split("/").at(-1)!.replace(/\.md$/, "");

        return {
          slug,
          title: titleOf(reference, slug),
          summary: openingParagraph(RAW[file] ?? ""),
          page: reference,
          href: url(`skills/${name}/${slug}/`),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    return {
      name,
      command: `/${plugin.name}:${name}`,
      description: page.frontmatter.description,
      argumentHint: page.frontmatter["argument-hint"],
      manual: page.frontmatter["disable-model-invocation"] === true,
      title: titleOf(page, name),
      loop: loopOf(RAW[path] ?? ""),
      page,
      headings: page.getHeadings(),
      references,
      href: url(`skills/${name}/`),
      source: `${REPO_URL}/tree/main/plugins/${plugin.name}/skills/${name}`,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Two ways in: the skills.sh CLI, which installs the skills for any agent that reads `SKILL.md`
 * (Claude Code, Codex, Cursor and the rest), and Claude Code's plugin marketplace.
 */
const INSTALL = {
  agents: "npx skills add zkmake/three-kit",
  claude: ["/plugin marketplace add zkmake/three-kit", `/plugin install ${plugin.name}@three-kit`],
} as const;

const PLUGIN = {
  name: plugin.name,
  version: plugin.version,
  description: plugin.description,
  source: `${REPO_URL}/tree/main/plugins/${plugin.name}`,
  href: url("skills/"),
};

export { INSTALL, PLUGIN, SKILLS };
export type { Reference, Skill };
