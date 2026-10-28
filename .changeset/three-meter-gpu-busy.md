---
"@zkmake/three-meter": patch
---

GPU time on WebGPU is the time the GPU was busy in the frame, not the sum of its render passes. three adds every pass's span, and on tile-based GPUs (Apple, most mobile) passes overlap, so a post-processing stack read several times its real cost (15 passes: 14 ms summed, 1.7 ms busy). Falls back to three's sum when its timestamp pool isn't the shape the meter knows.
