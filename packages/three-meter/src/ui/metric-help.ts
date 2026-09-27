/**
 * One plain-language line per metric: what it is, and what a bad reading
 * means. Shown as the label's tooltip and, with "explain metrics" on, under
 * each row. Keyed like the stat rows; the graphs reuse `fps`, `cpu`, `gpu`.
 */
const METRIC_HELP: Record<string, string> = {
  calls:
    "Separate draw commands sent to the GPU this frame. Fewer is better: merge or instance meshes that share a material.",
  cpu: "JavaScript time per frame: your update code plus three.js preparing the render. It has to fit the frame budget (16.7 ms at 60 FPS).",
  fps: "Frames drawn per second. Higher is smoother; most displays top out at 60 or 120.",
  geometries:
    "Geometries held in GPU memory. Should level off; a steady climb is a leak, so dispose() what you remove.",
  gpu: "Time the graphics card spent drawing the frame. High means shaders, overdraw or resolution are the bottleneck.",
  hitches:
    "Frames that took over twice as long as usual, in the last 1,000 frames. Each one is a visible stutter.",
  lines: "Line segments drawn this frame.",
  low: "Frame rate during the slowest 1% of frames. Far below FPS means stutter the average hides.",
  p99: "99% of frames finished within this many ms. Above the frame budget (16.7 ms at 60 FPS) means dropped frames.",
  passes:
    "Times renderer.render() ran this frame. Shadows, post-processing and extra cameras each add passes.",
  points: "Points drawn this frame.",
  shaders:
    "Compiled shader programs. A jump mid-session usually means a stutter while a new material compiled.",
  textures:
    "Textures held in GPU memory. Should level off; a steady climb is a leak, so dispose() what you remove.",
  triangles:
    "Triangles drawn this frame. Mostly GPU cost: use lower-poly models or level of detail to cut it.",
};

export { METRIC_HELP };
