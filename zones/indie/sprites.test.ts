// The Lot's sprite wiring: shipped sheets match their manifests, every prop blits exactly one sprite
// on-canvas once its sheet is registered, nothing blits (and nothing magenta shows) without sheets,
// the scattered dumpsters/crates don't move, and the procedural glows follow the sprites.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { clearSheets, type Frame, type Painter, registerSheet, type SpriteManifest } from "../../packages/core/src/index.ts";
import { createZone } from "./src/index.ts";
import { ENABLED_SPRITES, SPRITES } from "./src/scenery.ts";

const dir = new URL("../../apps/web/public/sprites/indie/", import.meta.url);
const manifest = (name: string): SpriteManifest => JSON.parse(readFileSync(new URL(`${name}.json`, dir), "utf8"));
const pngSize = (name: string) => {
  const b = readFileSync(new URL(`${name}.png`, dir));
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const registerAll = () => {
  for (const n of SPRITES) registerSheet("indie", n, { manifest: manifest(n) });
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

describe("The Lot sprites", () => {
  afterEach(clearSheets);

  it.each(SPRITES)("ships %s.png with a matching one-frame manifest", (name) => {
    const f = manifest(name).frames[name]!;
    expect(f).toBeDefined();
    expect(pngSize(name)).toEqual({ w: f.w, h: f.h });
    expect([f.x, f.y]).toEqual([0, 0]);
    expect(f.ax).toBeGreaterThanOrEqual(0);
    expect(f.ax).toBeLessThanOrEqual(f.w);
    // Anchor = projected ground point (footprint centre), a few px above the bottom edge.
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
    expect(count("warehouse")).toBe(1);
    expect(count("lamp")).toBe(8);
    expect(count("van")).toBe(1);
    expect(count("dumpster")).toBeGreaterThan(0);
    expect(count("crate")).toBeGreaterThan(0);
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

  it("scatters one sprite per procedural dumpster/crate, deterministically", () => {
    // Same seed, same draws: sprite count by kind must equal the procedural scatter.
    registerAll();
    const a = recorder();
    const zone = drawAll(a.p, { t: 0, dt: 0, motion: false });
    const scattered = zone.scenery.props.length - 1 - 1 - 8; // minus warehouse, van, 8 lamps
    expect(a.blits.filter((b) => b.frame === "dumpster" || b.frame === "crate").length).toBe(scattered);
    const b = recorder();
    drawAll(b.p, { t: 0, dt: 0, motion: false });
    expect(b.blits).toEqual(a.blits);
  });

  it("puts a sodium glow on every sprite lamp head and a neon glow at the warehouse door", () => {
    registerAll();
    const { p, blits, glows } = recorder();
    drawAll(p, { t: 1, dt: 0.1, motion: true });
    const lampHead = manifest("lamp").frames.lamp!;
    const lamps = blits.filter((b) => b.frame === "lamp");
    const sodium = glows.filter((g) => g.color === "#ffd68c");
    expect(sodium.length).toBe(lamps.length);
    for (const l of lamps) {
      // The glow sits within the sprite's box, in its top quarter (where the head is).
      const top = l.y - lampHead.ay;
      expect(sodium.some((g) => Math.abs(g.cx - l.x) <= lampHead.w && g.cy >= top && g.cy <= top + lampHead.h / 4 + 2)).toBe(true);
    }
    const wh = blits.find((b) => b.frame === "warehouse")!;
    const whf = manifest("warehouse").frames.warehouse!;
    const pink = glows.filter((g) => g.color === "#ff5fa2");
    expect(pink.length).toBe(1);
    // On the front-left (door) side of the building, in its lower half.
    expect(pink[0]!.cx).toBeLessThan(wh.x);
    expect(pink[0]!.cx).toBeGreaterThan(wh.x - whf.ax);
    expect(pink[0]!.cy).toBeGreaterThan(wh.y - whf.ay + whf.h / 2);
  });
});
