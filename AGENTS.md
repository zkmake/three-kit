# Agents

How the repo is laid out, built and released: [CONTRIBUTING.md](CONTRIBUTING.md). Read it first.

## Keep the agent docs current

The site serves the docs as markdown for coding agents: `llms.txt`, `llms-full.txt` and
`/<name>/README.md`, built by `apps/site/src/llms.ts`. With any change to the packages or the kit,
check they still tell the truth:

- A package added or removed: add or drop its README in `READMES` there, beside its
  `libraries.ts` entry.
- Its summary (`header`) is hand-written: update it when what it says changes (renderers, React
  support, entry points like `/ui` and `/react`, what the kit offers).
- A package's `job` or `summary` in `libraries.ts` is its line in `llms.txt`.
- In a README, write links absolute, except to a sibling package (`../three-audit`), which is
  rewritten.
