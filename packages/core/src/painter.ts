// Renderer-agnostic drawing surface in art pixels. Zones draw through this, so they never import a
// graphics library; the web app backs it with PixiJS (and a 2D canvas for small previews).
import type { Iso } from "./iso.ts";

export type Color = string; // "#rrggbb"

export interface Painter {
  rect(x: number, y: number, w: number, h: number, color: Color, alpha?: number): void;
  /** Filled polygon, flat [x0, y0, x1, y1, …]. */
  poly(points: number[], color: Color, alpha?: number): void;
  line(x0: number, y0: number, x1: number, y1: number, width: number, color: Color, alpha?: number): void;
  /** Additive light (beams, glows). Drawn above the normal layer. */
  glow(points: number[], color: Color, alpha: number): void;
}

export const hex = (r: number, g: number, b: number): Color =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** One iso floor tile centered on (cx, cy), drawn as pixel rows like the prototype. */
export function diamond(p: Painter, cx: number, cy: number, color: Color, tileH = 8): void {
  cx = Math.round(cx);
  cy = Math.round(cy);
  for (let i = 0; i < tileH; i++) {
    const k = i < tileH / 2 ? i : tileH - 1 - i;
    const hw = (k + 1) * 2;
    p.rect(cx - hw, cy - tileH / 2 + i, hw * 2, 1, color);
  }
}

const r = (v: number) => Math.round(v);

/** An iso box on tiles (x0, y0)+(w, d), h pixels tall. Returns the four ground corners. */
export function box(
  p: Painter,
  iso: Iso,
  x0: number,
  y0: number,
  w: number,
  d: number,
  h: number,
  top: Color,
  left: Color,
  right: Color,
) {
  const A = iso(x0, y0);
  const B = iso(x0 + w, y0);
  const C = iso(x0 + w, y0 + d);
  const D = iso(x0, y0 + d);
  p.poly([r(D[0]), r(D[1]), r(C[0]), r(C[1]), r(C[0]), r(C[1] - h), r(D[0]), r(D[1] - h)], left);
  p.poly([r(B[0]), r(B[1]), r(C[0]), r(C[1]), r(C[0]), r(C[1] - h), r(B[0]), r(B[1] - h)], right);
  p.poly([r(A[0]), r(A[1] - h), r(B[0]), r(B[1] - h), r(C[0]), r(C[1] - h), r(D[0]), r(D[1] - h)], top);
  return { A, B, C, D };
}
