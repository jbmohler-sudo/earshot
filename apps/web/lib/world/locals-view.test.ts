// Ambient locals must be where people look: on screen in the default camera view.
import type { Frame, TilePoint, ZonePlugin } from "@earshot/core";
import { describe, expect, it } from "vitest";
import { defaultCamera, inView, STAGE_DESKTOP, STAGE_PHONE } from "./camera";
import { ZONES } from "./zones";

/** Resting spot plus positions along any walking loop. */
function spots(l: NonNullable<ZonePlugin["locals"]>[number]): TilePoint[] {
  const out: TilePoint[] = [l.at];
  if (l.pos) for (let k = 0; k < 60; k++) out.push(l.pos({ t: k * 0.9, dt: 0.1, motion: true } as Frame));
  return out;
}

describe.each(Object.entries(ZONES))("locals in view: %s", (_id, z) => {
  const zone = z.create();
  const locals = zone.locals ?? [];

  it("all six are fully on screen on desktop, all the time", () => {
    const { cw, ch } = STAGE_DESKTOP;
    const cam = defaultCamera(zone.layout, cw, ch);
    const visible = locals.filter((l) => spots(l).every((t) => inView(cam, zone.layout, cw, ch, t)));
    expect(visible.map((l) => l.id)).toEqual(locals.map((l) => l.id));
    expect(visible.length).toBe(6);
  });

  it("at least four are on screen on a phone", () => {
    const { cw, ch } = STAGE_PHONE;
    const cam = defaultCamera(zone.layout, cw, ch);
    const visible = locals.filter((l) => inView(cam, zone.layout, cw, ch, l.at));
    expect(visible.length, `phone sees ${visible.map((l) => l.id).join(", ")}`).toBeGreaterThanOrEqual(4);
  });
});
