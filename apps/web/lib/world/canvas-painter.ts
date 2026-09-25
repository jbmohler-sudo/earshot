import type { Color, Painter } from "@earshot/core";

/** Painter over a 2D canvas, for small previews (the avatar picker). */
export function canvasPainter(g: CanvasRenderingContext2D): Painter {
  const fill = (color: Color, alpha: number) => {
    g.globalAlpha = alpha;
    g.fillStyle = color;
  };
  const path = (pts: number[]) => {
    g.beginPath();
    for (let i = 0; i < pts.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, pts[i]!, pts[i + 1]!);
    g.closePath();
  };
  return {
    rect(x, y, w, h, color, alpha = 1) {
      fill(color, alpha);
      g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
    },
    poly(pts, color, alpha = 1) {
      fill(color, alpha);
      path(pts);
      g.fill();
      g.globalAlpha = 1;
    },
    line(x0, y0, x1, y1, width, color, alpha = 1) {
      g.globalAlpha = alpha;
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.globalAlpha = 1;
    },
    glow(pts, color, alpha) {
      g.save();
      g.globalCompositeOperation = "lighter";
      fill(color, alpha);
      path(pts);
      g.fill();
      g.restore();
    },
  };
}
