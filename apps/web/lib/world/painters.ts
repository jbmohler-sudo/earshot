import type { Color, Painter } from "@earshot/core";
import { Graphics } from "pixi.js";

/** Painter over two PixiJS Graphics: a normal layer and an additive light layer above it. */
export class PixiPainter implements Painter {
  readonly base = new Graphics();
  readonly light = new Graphics();

  constructor() {
    this.light.blendMode = "add";
  }

  clear(): void {
    this.base.clear();
    this.light.clear();
  }

  rect(x: number, y: number, w: number, h: number, color: Color, alpha = 1): void {
    this.base.rect(x, y, w, h).fill({ color, alpha });
  }

  poly(points: number[], color: Color, alpha = 1): void {
    this.base.poly(points).fill({ color, alpha });
  }

  line(x0: number, y0: number, x1: number, y1: number, width: number, color: Color, alpha = 1): void {
    this.base.moveTo(x0, y0).lineTo(x1, y1).stroke({ width, color, alpha });
  }

  glow(points: number[], color: Color, alpha: number): void {
    this.light.poly(points).fill({ color, alpha });
  }
}
