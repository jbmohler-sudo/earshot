import type { Color, Painter, SpriteSheet } from "@earshot/core";
import { Graphics, Rectangle, Texture } from "pixi.js";
import type { LoadedSheet } from "./sprite-loader";

const subTexCache = new WeakMap<object, Map<string, Texture>>();

function subTexture(sheet: LoadedSheet, frame: string): Texture | null {
  const f = sheet.manifest.frames[frame];
  if (!f) return null;
  let per = subTexCache.get(sheet);
  if (!per) {
    per = new Map();
    subTexCache.set(sheet, per);
  }
  let t = per.get(frame);
  if (!t) {
    t = new Texture({ source: sheet.texture.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
    per.set(frame, t);
  }
  return t;
}

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

  sprite(sheet: SpriteSheet, frame: string, x: number, y: number, _alpha = 1): void {
    const f = sheet.manifest.frames[frame];
    const loaded = sheet as Partial<LoadedSheet>;
    const sub = loaded.texture ? subTexture(sheet as LoadedSheet, frame) : null;
    const gfx = this.base as unknown as {
      texture?: (t: Texture, tint: number, dx: number, dy: number, dw: number, dh: number) => void;
    };
    if (!f || !sub || typeof gfx.texture !== "function") {
      // No art yet, or this Pixi version can't texture-fill: draw the frame's
      // footprint so layout stays honest and nothing silently vanishes.
      if (f) this.base.rect(x - f.ax, y - f.ay, f.w, f.h).fill({ color: "#ff00ff", alpha: 0.35 });
      return;
    }
    // Textured quad in the same Graphics stream — draw order is preserved.
    // (Nearest-neighbour comes from the low-res RenderTexture scale-up.)
    gfx.texture(sub, 0xffffff, Math.round(x - f.ax), Math.round(y - f.ay), f.w, f.h);
  }
}
