---
"@zkmake/three-meter": minor
---

The HUD's frame is now `mountDevPanel` in `./ui`, shared by every zkmake dev panel (three-textures uses it): the docked host, the drag / compact-full / dim discs, wake on approach, and a new brand label on top of the card. The card is a `.perf-hud__card` wrapping `.perf-monitor`, so styles that targeted `.perf-hud > .perf-monitor` now need `.perf-hud__card > .perf-monitor`.
