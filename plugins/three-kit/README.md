# three-kit plugin for Claude Code

Agent skills for three.js and React Three Fiber scenes, built on the
[three-kit](https://zkmake.github.io/three-kit/) packages.

```text
/plugin marketplace add zkmake/three-kit
/plugin install three-kit@three-kit
```

| Skill                      | Does                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/three-kit:model-pass`    | Remodels one object at a time: baseline, remodel, audit, distance, verify, with a before/after numbers table. Its first run writes the project's `3D-STYLE.md` and budgets. |
| `/three-kit:scene-mockups` | Mocks up variants of one part of a scene in the app itself, shoots them, runs a model pass on what's there, and builds a page to pick from.                                 |

Both work in a model studio or mockup page built on
[`@zkmake/three-studio`](https://zkmake.github.io/three-kit/three-studio/), check with
[`@zkmake/three-audit`](https://zkmake.github.io/three-kit/three-audit/), and cut draws and
triangles with [`@zkmake/three-batch`](https://zkmake.github.io/three-kit/three-batch/). They
install those packages into your project rather than carrying copies, so they stay in step with
the packages' releases.

The skills run only when you type them. They keep the project's 3D style guide (`3D-STYLE.md`) as
a file in your repo: every pass reads it and writes back what it learned.
