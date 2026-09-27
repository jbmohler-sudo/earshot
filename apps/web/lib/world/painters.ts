import type { Color, Painter, SpriteSheet } from "@earshot/core";
import { Graphics, Rectangle, Texture } from "pixi.js";
import type { LoadedSheet } from "./sprite-loader";

/** Per-sheet cache of frame sub-textures (sheets live for the page's lifetime). */
const subTextures = new WeakMap<SpriteSheet, Map<string, Texture>>();

function subTexture(sheet: LoadedSheet, frame: string): Texture | null {
  const f = sheet.manifest.frames[frame];
  if (!f) return null;
  let per = subTextures.get(sheet);
  if (!per) subTextures.set(sheet, (per = new Map()));
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

  sprite(sheet: SpriteSheet, frame: string, x: number, y: number, alpha = 1): void {
    const f = sheet.manifest.frames[frame];
    const tex = (sheet as Partial<LoadedSheet>).texture ? subTexture(sheet as LoadedSheet, frame) : null;
    if (!f || !tex) {
      // A sheet that didn't come through the loader (no texture): show its footprint, never nothing.
      if (f) this.base.rect(x - f.ax, y - f.ay, f.w, f.h).fill({ color: "#ff00ff", alpha: 0.35 * alpha });
      return;
    }
    // Pixi 8's Graphics.texture() appends a textured quad to the same instruction stream, so it keeps
    // its place in the painter's order. Its alpha comes from the current fill style (whatever the last
    // fill() left behind), so set it explicitly.
    this.base.setFillStyle({ color: 0xffffff, alpha });
    this.base.texture(tex, 0xffffff, Math.round(x - f.ax), Math.round(y - f.ay), f.w, f.h);
  }
}
