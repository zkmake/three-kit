---
"@zkmake/three-meter": minor
"@zkmake/three-devtools": minor
---

The HUD's footer and report list the React and React Three Fiber versions beside three's, and `monitor.getEnvironment()` gains `react` and `r3f`. `PerfSampler` and `<DevTools>` supply them; a monitor you make yourself takes a `frameworks` option (`frameworkVersions` from `@zkmake/three-meter/react`), and otherwise reports what React DevTools can tell, or `null`.
