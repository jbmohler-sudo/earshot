// The Outskirts' sprite wiring: shipped sheets match their manifests, every prop blits exactly one sprite
// on-canvas once its sheet is registered, nothing blits (and nothing magenta shows) without sheets,
// the neon sign blinks by swapping for its procedural bars, and the procedural glows follow the sprites.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { clearSheets, type Frame, type Painter, registerSheet, type SpriteManifest } from "../../packages/core/src/index.ts";
import { createZone } from "./src/index.ts";
import { ENABLED_SPRITES, SPRITES } from "./src/scenery.ts";

const dir = new URL("../../apps/web/public/sprites/outskirts/", import.meta.url);
const manifest = (name: string): SpriteManifest => JSON.parse(readFileSync(new URL(`${name}.json`, dir), "utf8"));
const pngSize = (name: string) => {
  const b = readFileSync(new URL(`${name}.png`, dir));
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const registerAll = () => {
  for (const n of SPRITES) registerSheet("outskirts", n, { manifest: manifest(n) });
};

function drawAll(p: Painter, f: Frame) {
  const zone = createZone();
  for (const prop of [...zone.scenery.props].sort((a, b) => a.depth - b.depth)) prop.draw(p, f);
  return zone;
}

function recorder() {
  const blits: { frame: string; x: number; y: number; alpha: number | undefined }[] = [];
  const glows: { cx: number; cy: number; color: string }[] = [];
  const rects: { x: number; y: number; w: number; h: number; c: string }[] = [];
  const magenta: number[][] = [];
  const p: Painter = {
    rect: (x, y, w, h, c) => {
      rects.push({ x, y, w, h, c });
      if (c === "#ff00ff") magenta.push([x, y, w, h]);
    },
    poly: () => {},
    line: () => {},
    glow: (pts, color) => {
      let sx = 0;
      let sy = 0;
      for (let k = 0; k < pts.length; k += 2) {
        sx += pts[k]!;
        sy += pts[k + 1]!;
      }
      glows.push({ cx: sx / (pts.length / 2), cy: sy / (pts.length / 2), color });
    },
    sprite: (_s, frame, x, y, alpha) => void blits.push({ frame, x, y, alpha }),
  };
  return { p, blits, glows, rects, magenta };
}

describe("The Outskirts sprites", () => {
  afterEach(clearSheets);

  it.each(SPRITES)("ships %s.png with a matching one-frame manifest", (name) => {
    const f = manifest(name).frames[name]!;
    expect(f).toBeDefined();
    expect(pngSize(name)).toEqual({ w: f.w, h: f.h });
    expect([f.x, f.y]).toEqual([0, 0]);
    expect(f.ax).toBeGreaterThanOrEqual(0);
    expect(f.ax).toBeLessThanOrEqual(f.w);
    expect(f.ay).toBeLessThanOrEqual(f.h);
    expect(f.ay).toBeGreaterThanOrEqual(Math.ceil(f.h * 0.6));
  });

  it("asks the app to load only wired sheets", () => {
    expect(createZone().sprites).toBe(ENABLED_SPRITES);
    for (const n of ENABLED_SPRITES) expect(SPRITES).toContain(n);
  });

  it.each([true, false])("blits exactly one on-canvas sprite per prop once sheets load (motion %s)", (motion) => {
    registerAll();
    const { p, blits, magenta } = recorder();
    const zone = drawAll(p, { t: 0, dt: 0.1, motion });
    const count = (n: string) => blits.filter((b) => b.frame === n).length;
    expect(count("motel")).toBe(1);
    expect(count("neon_sign")).toBe(1);
    expect(count("water_tower")).toBe(1);
    expect(count("cactus_a") + count("cactus_b")).toBeGreaterThan(0);
    expect(count("pickup")).toBe(1);
    expect(count("floodlight")).toBe(7);
    expect(count("bar_counter")).toBe(1);
    // Rocks stay procedural boxes, so the blit count is the sprite props only.
    expect(blits.length).toBeGreaterThan(10);
    expect(blits.length).toBeLessThan(zone.scenery.props.length);
    const { w, h } = zone.layout.pixels;
    for (const b of blits) {
      const f = manifest(b.frame).frames[b.frame]!;
      expect(Number.isInteger(b.x) && Number.isInteger(b.y), b.frame).toBe(true);
      expect(b.x - f.ax, b.frame).toBeGreaterThanOrEqual(0);
      expect(b.y - f.ay, b.frame).toBeGreaterThanOrEqual(0);
      expect(b.x - f.ax + f.w, b.frame).toBeLessThanOrEqual(w);
      expect(b.y, b.frame).toBeLessThanOrEqual(h);
      expect(b.alpha).toBe(1);
    }
    expect(magenta).toEqual([]);
  });

  it("draws procedurally, with no blits and no placeholders, when no sheet is loaded", () => {
    const { p, blits, magenta, rects } = recorder();
    drawAll(p, { t: 3, dt: 0.1, motion: true });
    expect(blits).toEqual([]);
    expect(magenta).toEqual([]);
    expect(rects.some((r) => r.c === "#4fd1e0" || r.c === "#1f3a40")).toBe(true);
  });

  it("sorts the motel before the door yard in front of it", () => {
    registerAll();
    const { p, blits } = recorder();
    drawAll(p, { t: 0, dt: 0, motion: false });
    const order = blits.map((b) => b.frame);
    expect(order.indexOf("motel")).toBeLessThan(order.indexOf("bar_counter"));
  });

  it("blinks the neon sign by swapping the sprite for its dark procedural bars", () => {
    registerAll();
    const lit = recorder();
    drawAll(lit.p, { t: 0, dt: 0, motion: false });
    expect(lit.blits.filter((b) => b.frame === "neon_sign")).toHaveLength(1);
    expect(lit.rects.some((r) => r.c === "#1f3a40")).toBe(false);
    const dark = recorder();
    drawAll(dark.p, { t: 1.36, dt: 0.1, motion: true });
    expect(dark.blits.filter((b) => b.frame === "neon_sign")).toHaveLength(0);
    expect(dark.rects.some((r) => r.c === "#1f3a40")).toBe(true);
  });

  it("puts a white cone on every floodlight head", () => {
    registerAll();
    const { p, blits, glows } = recorder();
    drawAll(p, { t: 1, dt: 0.1, motion: true });
    const head = manifest("floodlight").frames.floodlight!;
    const lights = blits.filter((b) => b.frame === "floodlight");
    const cones = glows.filter((g) => g.color === "#e8f0f0");
    expect(cones.length).toBe(lights.length);
    for (const l of lights) {
      const top = l.y - head.ay;
      expect(cones.some((g) => Math.abs(g.cx - l.x) <= head.w && g.cy >= top && g.cy <= top + head.h / 4 + 2)).toBe(true);
    }
  });
});
