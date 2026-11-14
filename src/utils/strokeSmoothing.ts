import type { Point, ToolType } from '../types/whiteboard.ts';

export interface BezierSegment {
  p0: Point;
  cp1: Point;
  cp2: Point;
  p1: Point;
  width: number;
}

/**
 * Filter out jitter and noise from raw input points.
 * Removes duplicate/redundant points that are closer than minDistance,
 * and applies a weighted exponential moving average for jitter-free handwriting.
 */
export function filterAndSmoothPoints(rawPoints: Point[], minDistance = 2.5): Point[] {
  if (rawPoints.length <= 2) return rawPoints;

  const filtered: Point[] = [rawPoints[0]];

  for (let i = 1; i < rawPoints.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = rawPoints[i];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);

    // Keep point if it has moved past the jitter threshold
    if (dist >= minDistance || i === rawPoints.length - 1) {
      // Light low-pass filter to smooth micro-tremors from mouse/stylus
      const smoothedX = prev.x * 0.2 + curr.x * 0.8;
      const smoothedY = prev.y * 0.2 + curr.y * 0.8;
      const pressure = curr.pressure ?? prev.pressure ?? 0.5;

      filtered.push({
        x: Number(smoothedX.toFixed(2)),
        y: Number(smoothedY.toFixed(2)),
        pressure,
      });
    }
  }

  return filtered;
}

/**
 * Converts a series of points into Catmull-Rom cubic Bézier curve segments.
 * Catmull-Rom splines pass directly through each data point while ensuring
 * continuous first-derivative smoothness (C1 continuity), preventing jagged corners.
 */
export function getCatmullRomBezierSegments(
  points: Point[],
  baseWidth: number,
  tension = 0.5
): BezierSegment[] {
  if (points.length < 2) return [];

  const segments: BezierSegment[] = [];
  const k = tension / 3; // Scaling factor for Catmull-Rom to Cubic Bézier

  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Virtual p0 for start of stroke (reflect p2 across p1)
    const p0 = i > 0 
      ? points[i - 1] 
      : { x: p1.x - (p2.x - p1.x) * 0.5, y: p1.y - (p2.y - p1.y) * 0.5, pressure: p1.pressure };

    // Virtual p3 for end of stroke (reflect p1 across p2)
    const p3 = i < n - 2 
      ? points[i + 2] 
      : { x: p2.x + (p2.x - p1.x) * 0.5, y: p2.y + (p2.y - p1.y) * 0.5, pressure: p2.pressure };

    // Compute cubic Bézier control points
    const cp1: Point = {
      x: p1.x + (p2.x - p0.x) * k,
      y: p1.y + (p2.y - p0.y) * k,
    };

    const cp2: Point = {
      x: p2.x - (p3.x - p1.x) * k,
      y: p2.y - (p3.y - p1.y) * k,
    };

    // Calculate natural pressure/taper dynamic width
    const p1Pressure = p1.pressure ?? 0.5;
    const p2Pressure = p2.pressure ?? 0.5;
    const avgPressure = (p1Pressure + p2Pressure) / 2;

    // Tapering at endpoints for natural calligraphy/ink feeling
    let taperFactor = 1.0;
    if (i === 0) taperFactor *= 0.65;
    else if (i === 1) taperFactor *= 0.85;
    if (i === n - 2) taperFactor *= 0.65;
    else if (i === n - 3) taperFactor *= 0.85;

    // Dynamic width with pressure variation: 70% to 130% of baseWidth
    const dynamicWidth = Math.max(
      1.5,
      baseWidth * (0.75 + avgPressure * 0.5) * taperFactor
    );

    segments.push({
      p0: p1,
      cp1,
      cp2,
      p1: p2,
      width: dynamicWidth,
    });
  }

  return segments;
}

/**
 * Draws a smooth handwritten stroke on HTML5 Canvas using Catmull-Rom
 * Cubic Bézier interpolation with natural ink tapering and chalk texturing.
 */
export function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  rawPoints: Point[],
  color: string,
  width: number,
  tool: ToolType,
  chalkEffect: boolean
): void {
  if (!rawPoints || rawPoints.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Single Point / Dot tap
  if (rawPoints.length === 1) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const radius = Math.max(1.5, width / 2);
    ctx.arc(rawPoints[0].x, rawPoints[0].y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 2. Filter jitter and prepare points
  const points = filterAndSmoothPoints(rawPoints, 2.0);
  if (points.length < 2) {
    ctx.restore();
    return;
  }

  // 3. Two points: straight tapered segment
  if (points.length === 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 4. Highlighter tool: flat translucent ribbon
  if (tool === 'highlighter') {
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 3.5;
    ctx.globalAlpha = 0.35;

    const segments = getCatmullRomBezierSegments(points, width * 3.5, 0.4);
    ctx.beginPath();
    ctx.moveTo(segments[0].p0.x, segments[0].p0.y);
    for (const seg of segments) {
      ctx.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.p1.x, seg.p1.y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 5. Chalk effect: soft textured organic curve
  if (tool === 'chalk' || chalkEffect) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.90;
    ctx.shadowColor = color;
    ctx.shadowBlur = 1.2;

    const segments = getCatmullRomBezierSegments(points, width, 0.5);

    // Draw consecutive Bézier segments with smooth width transitions
    for (const seg of segments) {
      ctx.lineWidth = seg.width;
      ctx.beginPath();
      ctx.moveTo(seg.p0.x, seg.p0.y);
      ctx.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.p1.x, seg.p1.y);
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  // 6. Standard / Smooth Pen: Catmull-Rom Cubic Bézier with dynamic ink width
  ctx.strokeStyle = color;

  const segments = getCatmullRomBezierSegments(points, width, 0.5);

  for (const seg of segments) {
    ctx.lineWidth = seg.width;
    ctx.beginPath();
    ctx.moveTo(seg.p0.x, seg.p0.y);
    ctx.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.p1.x, seg.p1.y);
    ctx.stroke();
  }

  ctx.restore();
}
