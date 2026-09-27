// The Forge's sprite wiring: shipped sheets match their manifests, every wired prop blits on-canvas
// once its sheet is registered, nothing blits (and nothing magenta shows) without sheets, and the
// building sorts between the chimney behind it and the door yard in front of it.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { clearSheets, type Frame, type Painter, registerSheet, type SpriteManifest } from "../../packages/core/src/index.ts";
import { createZone } from "./src/index.ts";
import { ENABLED_SPRITES, SPRITES } from "./src/scenery.ts";

const dir = new URL("../../apps/web/public/sprites/metal/", import.meta.url);
const manifest = (name: string): SpriteManifest => JSON.parse(readFileSync(new URL(`${name}.json`, dir), "utf8"));
const pngSize = (name: string) => {
  const b = readFileSync(new URL(`${name}.png`, dir));
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

function drawAll(p: Painter, f: Frame) {
  const zone = createZone();
  for (const prop of [...zone.scenery.props].sort((a, b) => a.depth - b.depth)) prop.draw(p, f);
}

function recorder() {
  const blits: { frame: string; x: number; y: number; alpha: number | undefined }[] = [];
  const magenta: number[][] = [];
  const p: Painter = {
    rect: (x, y, w, h, c) => void (c === "#ff00ff" && magenta.push([x, y, w, h])),
    poly: () => {},
    line: () => {},
    glow: () => {},
    sprite: (_s, frame, x, y, alpha) => void blits.push({ frame, x, y, alpha }),
  };
  return { p, blits, magenta };
}

describe("Forge sprites", () => {
  afterEach(clearSheets);

  it.each(SPRITES)("ships %s.png with a matching one-frame manifest", (name) => {
    const m = manifest(name);
    const f = m.frames[name]!;
    expect(f).toBeDefined();
    expect(pngSize(name)).toEqual({ w: f.w, h: f.h });
    expect([f.x, f.y]).toEqual([0, 0]);
    expect(f.ax).toBeGreaterThanOrEqual(0);
    expect(f.ax).toBeLessThanOrEqual(f.w);
    expect(f.ay).toBe(f.h); // anchored on the ground line
  });

  it("asks the app to load only wired sheets", () => {
    expect(createZone().sprites).toBe(ENABLED_SPRITES);
    for (const n of ENABLED_SPRITES) expect(SPRITES).toContain(n);
  });

  it.each([true, false])("blits every wired prop on-canvas once its sheet is loaded (motion %s)", (motion) => {
    for (const n of SPRITES) registerSheet("metal", n, { manifest: manifest(n) });
    const { p, blits, magenta } = recorder();
    drawAll(p, { t: 3, dt: 0.1, motion });
    const count = (n: string) => blits.filter((b) => b.frame === n).length;
    expect({ forge: count("forge"), anvil: count("anvil"), chimney: count("chimney"), barrel: count("barrel"), toolrack: count("toolrack"), brazier: count("brazier") }).toEqual({
      forge: 1,
      anvil: 1,
      chimney: 1,
      barrel: 1,
      toolrack: 1,
      brazier: 8,
    });
    const { w, h } = createZone().layout.pixels;
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

  it("sorts the building after the chimney behind it and before the door yard in front", () => {
    for (const n of SPRITES) registerSheet("metal", n, { manifest: manifest(n) });
    const { p, blits } = recorder();
    drawAll(p, { t: 0, dt: 0, motion: false });
    const order = blits.map((b) => b.frame).filter((n) => n !== "brazier");
    expect(order.indexOf("chimney")).toBeLessThan(order.indexOf("forge"));
    for (const n of ["anvil", "barrel", "toolrack"]) expect(order.indexOf("forge"), n).toBeLessThan(order.indexOf(n));
  });
});
