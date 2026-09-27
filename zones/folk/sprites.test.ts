// The Hollow's sprite wiring: shipped sheets match their manifests, every prop blits exactly one sprite
// on-canvas once its sheet is registered, nothing blits (and nothing magenta shows) without sheets,
// and the procedural glows follow the sprites.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { clearSheets, type Frame, type Painter, registerSheet, type SpriteManifest } from "../../packages/core/src/index.ts";
import { createZone } from "./src/index.ts";
import { ENABLED_SPRITES, SPRITES } from "./src/scenery.ts";

const dir = new URL("../../apps/web/public/sprites/folk/", import.meta.url);
const manifest = (name: string): SpriteManifest => JSON.parse(readFileSync(new URL(`${name}.json`, dir), "utf8"));
const pngSize = (name: string) => {
  const b = readFileSync(new URL(`${name}.png`, dir));
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const registerAll = () => {
  for (const n of SPRITES) registerSheet("folk", n, { manifest: manifest(n) });
};

function drawAll(p: Painter, f: Frame) {
  const zone = createZone();
  for (const prop of [...zone.scenery.props].sort((a, b) => a.depth - b.depth)) prop.draw(p, f);
  return zone;
}

function recorder() {
  const blits: { frame: string; x: number; y: number; alpha: number | undefined }[] = [];
  const glows: { cx: number; cy: number; color: string }[] = [];
  const magenta: number[][] = [];
  const p: Painter = {
    rect: (x, y, w, h, c) => void (c === "#ff00ff" && magenta.push([x, y, w, h])),
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
  return { p, blits, glows, magenta };
}

describe("The Hollow sprites", () => {
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
    const zone = drawAll(p, { t: 3, dt: 0.1, motion });
    expect(blits.length).toBe(zone.scenery.props.length);
    const count = (n: string) => blits.filter((b) => b.frame === n).length;
    expect(count("cabin")).toBe(1);
    expect(count("pine_dark") + count("pine_light")).toBeGreaterThan(0);
    expect(count("lantern")).toBe(8);
    expect(count("campfire")).toBe(1);
    expect(count("haybale")).toBe(3);
    expect(blits.length).toBe(zone.scenery.props.length);
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
    const { p, blits, magenta } = recorder();
    drawAll(p, { t: 3, dt: 0.1, motion: true });
    expect(blits).toEqual([]);
    expect(magenta).toEqual([]);
  });

  it("sorts the cabin before the door yard in front of it", () => {
    registerAll();
    const { p, blits } = recorder();
    drawAll(p, { t: 0, dt: 0, motion: false });
    const order = blits.map((b) => b.frame);
    expect(order.indexOf("cabin")).toBeLessThan(order.indexOf("campfire"));
  });

  it("puts a warm glow on every lantern head and an orange glow on the campfire's flame", () => {
    registerAll();
    const { p, blits, glows } = recorder();
    drawAll(p, { t: 1, dt: 0.1, motion: true });
    const head = manifest("lantern").frames.lantern!;
    const lanterns = blits.filter((b) => b.frame === "lantern");
    const warm = glows.filter((g) => g.color === "#ffbe5a");
    expect(warm.length).toBe(lanterns.length + 1); // the extra one is the cabin window
    for (const l of lanterns) {
      const top = l.y - head.ay;
      expect(warm.some((g) => Math.abs(g.cx - l.x) <= head.w && g.cy >= top && g.cy <= top + head.h / 2)).toBe(true);
    }
    const fire = blits.find((b) => b.frame === "campfire")!;
    const flame = manifest("campfire").frames.campfire!;
    const orange = glows.filter((g) => g.color === "#ff8a2b");
    expect(orange.length).toBe(1);
    expect(Math.abs(orange[0]!.cx - fire.x)).toBeLessThanOrEqual(flame.w);
    expect(orange[0]!.cy).toBeLessThan(fire.y - flame.ay + flame.h / 2);
  });
});
