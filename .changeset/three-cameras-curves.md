---
"@zkmake/three-cameras": minor
---

Curve and graph editors for camera moves. The key inspector shows the ease into the next key as a curve with two handles to drag (custom cubic Bézier eases, overshoot and anticipation included). The timeline's Graph view plots the picked camera's channels over time (position, rotation, fov or zoom, near, far) as they play; drag a key's dot to change that value or retime it, click between keys to pick a segment, double-click to add a key. A path toggle per lane draws the camera's motion path in the scene. New on the lab: `updateKey` takes `bezier` and `pose`, `setTrail`; and channel helpers `readChannel`, `writeChannel`, `sampleChannel`, plus `cubicBezier`.
