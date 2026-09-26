// Contract checks every zone plug-in must pass: sane layout, and every drawing path produces finite,
// on-canvas geometry with and without motion.
import { describe, expect, it } from "vitest";
import type { Frame, Painter, Tier, ZonePlugin } from "../packages/core/src/index.ts";
import { createZone as folk } from "./folk/src/index.ts";
import { createZone as indie } from "./indie/src/index.ts";
import { createZone as metal } from "./metal/src/index.ts";
import { createZone as outskirts } from "./outskirts/src/index.ts";
import { LAYOUTS, ZONE_IDS } from "./registry.ts";

const ZONES: [string, () => ZonePlugin][] = [["metal", metal], ["indie", indie], ["folk", folk], ["outskirts", outskirts]];
const TIERS: Tier[] = ["busker", "tavern", "amph", "fest"];

/** Records the extent of everything drawn (running min/max, not every number) and any non-finite value. */
function recorder() {
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, finite: true, calls: 0 };
  const take = (...xs: number[]) => {
    box.calls++;
    for (let i = 0; i < xs.length; i += 2) {
      const x = xs[i]!;
      const y = xs[i + 1]!;
      if (!Number.isFinite(x) || !Number.isFinite(y)) box.finite = false;
      box.minX = Math.min(box.minX, x);
      box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y);
      box.maxY = Math.max(box.maxY, y);
    }
  };
  const p: Painter = {
    rect: (x, y, w, h) => take(x, y, x + w, y + h),
    poly: (pts) => take(...pts),
    line: (x0, y0, x1, y1) => take(x0, y0, x1, y1),
    glow: (pts) => take(...pts),
  };
  return { p, box };
}

describe.each(ZONES)("zone %s", (id, create) => {
  const zone = create();
  const { layout } = zone;

  it("is registered for server-side layout with the same geometry", () => {
    expect(ZONE_IDS).toContain(id);
    expect(zone.id).toBe(id);
    expect(LAYOUTS[id]).toBe(layout);
  });

  it("has well-spaced slots inside the bounds, clear of the plaza", () => {
    expect(layout.slots.length).toBeGreaterThanOrEqual(5);
    const { bounds, plaza } = layout;
    for (const [x, y] of layout.slots) {
      expect(x).toBeGreaterThan(bounds.x0 + 2);
      expect(x).toBeLessThan(bounds.x1 - 2);
      expect(y).toBeGreaterThan(bounds.y0 + 2);
      expect(y).toBeLessThan(bounds.y1 - 2);
      const dx = Math.max(plaza.x0 - x, 0, x - plaza.x1);
      const dy = Math.max(plaza.y0 - y, 0, y - plaza.y1);
      expect(Math.hypot(dx, dy)).toBeGreaterThan(3);
    }
    // Slot 0 hosts the festival (widest crowd); the rest need a little less room. The Forge's own
    // prototype spacing (7.8 between its closest pair) is the floor.
    for (let a = 0; a < layout.slots.length; a++)
      for (let b = a + 1; b < layout.slots.length; b++) {
        const [ax, ay] = layout.slots[a]!;
        const [bx, by] = layout.slots[b]!;
        expect(Math.hypot(ax - bx, ay - by), `slots ${a} and ${b}`).toBeGreaterThan(a === 0 ? 10 : 7.5);
      }
  });

  it.each([true, false])("draws finite, on-canvas geometry (motion %s)", (motion) => {
    const { p, box } = recorder();
    const { w, h } = layout.pixels;
    zone.scenery.ground(p);
    // Many frames so particle systems, trains and cars get exercised.
    for (let k = 0; k < 240; k++) {
      const f: Frame = { t: k * 0.5, dt: 0.5, motion };
      zone.scenery.underlay?.(p, f);
      for (const prop of zone.scenery.props) prop.draw(p, f);
      layout.slots.forEach((at, slot) => {
        const tier = TIERS[slot % TIERS.length]!;
        const v = { slot, at, tier, count: 1 };
        zone.venueStyles[tier].draw(p, v, f);
        zone.venueStyles[tier].overlay?.(p, v, f);
      });
      zone.scenery.overlay?.(p, f);
    }
    expect(box.calls).toBeGreaterThan(1000);
    expect(box.finite).toBe(true);
    expect(box.minX).toBeGreaterThan(-60);
    expect(box.maxX).toBeLessThan(w + 60);
    expect(box.minY).toBeGreaterThan(-60);
    expect(box.maxY).toBeLessThan(h + 60);
  });

  it("gives every tier a label height and tap reach", () => {
    for (const t of TIERS) {
      expect(zone.venueStyles[t].labelLift).toBeGreaterThan(0);
      expect(zone.venueStyles[t].reach).toBeGreaterThan(10);
    }
  });
});
