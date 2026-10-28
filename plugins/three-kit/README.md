# three-kit agent skills

Agent skills for three.js and React Three Fiber scenes, built on the
[three-kit](https://zkmake.github.io/three-kit/) packages. They install in Claude Code as a plugin,
or in any agent that reads skills (Codex, Cursor and others) through [skills.sh](https://skills.sh).

**Claude Code**: add the marketplace, install the plugin, then type `/three-kit:<skill>`.

```text
/plugin marketplace add zkmake/three-kit
/plugin install three-kit@three-kit
```

**Any agent**: install the skills, then ask for one by name ("run perf-pass on the city").

```sh
npx skills add zkmake/three-kit
```

| Skill           | Does                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model-pass`    | Remodels one object at a time: baseline, remodel, audit, distance, verify, with a before/after numbers table. Its first run writes the project's `3D-STYLE.md` and budgets.                               |
| `scene-mockups` | Mocks up variants of one part of a scene in the app itself, shoots them, runs a model pass on what's there, and builds a page to pick from.                                                               |
| `perf-pass`     | Fits the whole frame to the project's budgets: surveys draws and triangles at every play position, ranks areas by what the frame really draws, fixes one area per pass, diffs the play view.              |
| `kit-adopt`     | Moves one app onto the packages: a budgets file its tests hold, one `?debug` drop-in, a three-studio page and adaptive pixel ratio in place of its copies; diffs the play view and reports lines removed. |

They work in a model studio or mockup page built on
[`@zkmake/three-studio`](https://zkmake.github.io/three-kit/three-studio/), check with
[`@zkmake/three-audit`](https://zkmake.github.io/three-kit/three-audit/), and cut draws and
triangles with [`@zkmake/three-batch`](https://zkmake.github.io/three-kit/three-batch/);
`kit-adopt` also wires in [`@zkmake/three-devtools`](https://zkmake.github.io/three-kit/three-devtools/)
and [`@zkmake/three-quality`](https://zkmake.github.io/three-kit/three-quality/). They install
those packages into your project rather than carrying copies, so they stay in step with
the packages' releases.

In Claude Code the skills run only when you type them; other agents pick one when you ask for it.
They keep the project's 3D style guide (`3D-STYLE.md`) as a file in your repo: every pass reads it
and writes back what it learned.
