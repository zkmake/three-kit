/**
 * Minimal canvas sparkline. The caller owns the canvas, its size, and any
 * device-pixel-ratio transform; this just paints a filled line series in
 * logical (CSS) pixel coordinates. An optional guide (a budget) is drawn as a
 * dashed line when it falls inside the series' range. The scale never
 * stretches to fit it, so a CPU series at 0.2 ms keeps its shape under a
 * 16.7 ms budget and the line appears once the series gets near.
 */
type SparklineStyle = {
  fill: string;
  stroke: string;
};

type SparklineGuide = {
  color: string;
  value: number;
};

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: readonly number[],
  style: SparklineStyle,
  guide?: SparklineGuide,
) {
  ctx.clearRect(0, 0, width, height);

  if (values.length < 2) {
    return;
  }

  let max = 0;

  for (const value of values) {
    if (value > max) {
      max = value;
    }
  }

  const range = max * 1.1 || 1;
  const stepX = width / (values.length - 1);
  const toY = (value: number) => height - (value / range) * height;

  ctx.beginPath();
  ctx.moveTo(0, toY(values[0]!));

  for (let index = 1; index < values.length; index += 1) {
    ctx.lineTo(index * stepX, toY(values[index]!));
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();

  if (guide && guide.value > 0 && guide.value <= range) {
    // Half-pixel offset keeps a 1px line crisp.
    const y = Math.round(toY(guide.value)) + 0.5;
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = guide.color;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.restore();
  }
}

export { drawSparkline };
export type { SparklineGuide, SparklineStyle };
