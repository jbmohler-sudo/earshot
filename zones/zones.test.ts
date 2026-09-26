// Contract checks every zone plug-in must pass: sane layout, and every drawing path produces finite,
// on-canvas geometry with and without motion.
import { describe, expect, it } from "vitest";
import { type Frame, localsToShow, type Painter, spotFor, type Tier, tierOf, type ZonePlugin } from "../packages/core/src/index.ts";
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

  it("has six ambient locals, clear of every crowd they can meet", () => {
    const locals = zone.locals ?? [];
    expect(locals).toHaveLength(6);
    expect(new Set(locals.map((l) => l.id)).size).toBe(locals.length);
    const HALF: Record<Tier, number> = { busker: 0.5, tavern: 1, amph: 1.5, fest: 2.4 };
    locals.forEach((l, i) => {
      // The biggest crowd this local ever shares the zone with (locals thin out as people arrive).
      let nMax = 0;
      for (let n = 0; n <= 60; n++) if (localsToShow(n, locals.length) > i) nMax = n;
      const n = Math.max(1, nMax);
      const tier = tierOf(n);
      const path = [l.at, ...Array.from({ length: 40 }, (_, k) => l.pos?.({ t: k * 1.3, dt: 0.1, motion: true }) ?? l.at)];
      for (const at of layout.slots) {
        // Every spot that crowd could fill at this venue: front rows and field, both jitter extremes.
        const crowd: [number, number][] = [];
        for (const kind of ["front", "field"] as const)
          for (let idx = 0; idx < n; idx++) for (const j of [0, 0.25]) crowd.push([...spotFor(at, tier, kind, idx, j, layout.bounds)] as [number, number]);
        for (const [x, y] of path) {
          expect(Math.max(Math.abs(x - at[0]), Math.abs(y - at[1])), `${l.id} on the ${tier} at ${at}`).toBeGreaterThanOrEqual(HALF[tier] + 0.4);
          const nearest = Math.min(...crowd.map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
          expect(nearest, `${l.id} (shown up to ${nMax} people) vs crowd at ${at}`).toBeGreaterThanOrEqual(0.7);
        }
      }
      for (const [x, y] of path) {
        expect(x, l.id).toBeGreaterThanOrEqual(layout.bounds.x0);
        expect(x, l.id).toBeLessThanOrEqual(layout.bounds.x1);
        expect(y, l.id).toBeGreaterThanOrEqual(layout.bounds.y0 + 0.4);
        expect(y, l.id).toBeLessThanOrEqual(layout.bounds.y1);
      }
    });
  });

  it.each([true, false])("locals draw finite, on-canvas geometry (motion %s)", (motion) => {
    const { p, box } = recorder();
    for (let k = 0; k < 120; k++) for (const l of zone.locals ?? []) l.draw(p, { t: k * 0.5, dt: 0.5, motion });
    expect(box.finite).toBe(true);
    expect(box.minX).toBeGreaterThan(-20);
    expect(box.maxX).toBeLessThan(layout.pixels.w + 20);
    expect(box.minY).toBeGreaterThan(-20);
    expect(box.maxY).toBeLessThan(layout.pixels.h + 20);
  });

  it("locals hold a static pose with reduced motion", () => {
    const calls = (t: number) => {
      const out: string[] = [];
      const p: Painter = {
        rect: (...a) => void out.push(`r${a.join(",")}`),
        poly: (...a) => void out.push(`p${JSON.stringify(a)}`),
        line: (...a) => void out.push(`l${a.join(",")}`),
        glow: (...a) => void out.push(`g${JSON.stringify(a)}`),
      };
      for (const l of zone.locals ?? []) {
        l.draw(p, { t, dt: 0.016, motion: false });
        out.push(`at${(l.pos?.({ t, dt: 0.016, motion: false }) ?? l.at).join(",")}`);
      }
      return out;
    };
    expect(calls(0)).toEqual(calls(7.3));
    expect(calls(0)).toEqual(calls(123.4));
  });

  it("gives every tier a label height and tap reach", () => {
    for (const t of TIERS) {
      expect(zone.venueStyles[t].labelLift).toBeGreaterThan(0);
      expect(zone.venueStyles[t].reach).toBeGreaterThan(10);
    }
  });
});
