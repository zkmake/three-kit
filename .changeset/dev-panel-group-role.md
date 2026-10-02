---
"@zkmake/three-meter": patch
---

The dev-panel frame (the HUD, and the texture and camera panels built on it) is now a named group (`role="group"`), so screen readers announce its label ("Performance", or the HUD's `label`) instead of dropping an `aria-label` on a plain div.
