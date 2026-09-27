import { afterEach, describe, expect, it } from "vitest";
import type { Painter } from "./painter.ts";
import { clearSheets, drawSprite, frameFor, getSheet, registerSheet, type SpriteSheet } from "./sprites.ts";

type Call = [string, ...unknown[]];

function recording(withSprite: boolean): { p: Painter; calls: Call[] } {
  const calls: Call[] = [];
  const p: Painter = {
    rect: (...a) => void calls.push(["rect", ...a]),
    poly: (...a) => void calls.push(["poly", ...a]),
    line: (...a) => void calls.push(["line", ...a]),
    glow: (...a) => void calls.push(["glow", ...a]),
  };
  if (withSprite) p.sprite = (sheet, frame, x, y, alpha) => void calls.push(["sprite", sheet, frame, x, y, alpha]);
  return { p, calls };
}

const sheet: SpriteSheet = {
  manifest: { frames: { crate: { x: 0, y: 0, w: 20, h: 30, ax: 10, ay: 30 } }, animations: { idle: ["crate", "crate2"] } },
};

describe("drawSprite", () => {
  it("blits the frame at the rounded anchor with the given alpha", () => {
    const { p, calls } = recording(true);
    drawSprite(p, sheet, "crate", 10.4, 20.6, 0.5, () => calls.push(["fallback"]));
    expect(calls).toEqual([["sprite", sheet, "crate", 10, 21, 0.5]]);
  });

  it("runs the fallback while the sheet isn't loaded", () => {
    const { p, calls } = recording(true);
    drawSprite(p, null, "crate", 10, 20, 1, () => calls.push(["fallback"]));
    expect(calls).toEqual([["fallback"]]);
  });

  it("runs the fallback when the painter can't blit or the frame is unknown", () => {
    const a = recording(false);
    drawSprite(a.p, sheet, "crate", 10, 20, 1, () => a.calls.push(["fallback"]));
    expect(a.calls).toEqual([["fallback"]]);
    const b = recording(true);
    drawSprite(b.p, sheet, "nope", 10, 20, 1, () => b.calls.push(["fallback"]));
    expect(b.calls).toEqual([["fallback"]]);
  });

  it("without a fallback, shows a translucent footprint instead of nothing", () => {
    const { p, calls } = recording(false);
    drawSprite(p, sheet, "crate", 50, 60, 1);
    expect(calls).toEqual([["rect", 40, 30, 20, 30, "#ff00ff", 0.35]]);
  });
});

describe("sheet registry", () => {
  afterEach(clearSheets);

  it("returns null until a sheet is registered, then that sheet, per zone and name", () => {
    expect(getSheet("z", "crate")).toBeNull();
    registerSheet("z", "crate", sheet);
    expect(getSheet("z", "crate")).toBe(sheet);
    expect(getSheet("other", "crate")).toBeNull();
    clearSheets();
    expect(getSheet("z", "crate")).toBeNull();
  });
});

describe("frameFor", () => {
  it("cycles an animation's frames at fps and is null for unknown animations", () => {
    expect(frameFor(sheet.manifest, "idle", 0, 8)).toBe("crate");
    expect(frameFor(sheet.manifest, "idle", 0.125, 8)).toBe("crate2");
    expect(frameFor(sheet.manifest, "idle", 0.25, 8)).toBe("crate");
    expect(frameFor(sheet.manifest, "walk", 1)).toBeNull();
  });
});
