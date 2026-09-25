// The Forge's four venue tiers: busker, tavern, amphitheater, festival. Ported from Phase 0.
import { box, diamond, drawPerson, type Frame, type Look, type Painter, type Tier, type VenueStyle, type VenueView } from "@earshot/core";
import { brazier, iso } from "./scenery.ts";

/** Half-width of each tier's footprint (tiles) and how far its label floats (art px). */
const TIER_GEOM: Record<Tier, { h: number; lift: number }> = {
  busker: { h: 0.5, lift: 18 },
  tavern: { h: 1.0, lift: 34 },
  amph: { h: 1.5, lift: 26 },
  fest: { h: 2.4, lift: 58 },
};

const PERFORMER: Look = { skin: "#d9a47c", hair: "#0f0b0a", long: true, shirt: "#0d0a09", print: "#ff6a2b", pants: "#0d0d10" };

function performer(p: Painter, x: number, y: number, lift: number, f: Frame, k: number, guitar: boolean): void {
  const [cx, cy] = iso(x, y);
  const bob = f.motion && Math.sin(f.t * 9 + k * 1.7) > 0.2 ? 1 : 0;
  drawPerson(p, cx, cy - lift, PERFORMER, bob, 0, false);
  if (guitar) {
    p.rect(Math.round(cx) - 3, Math.round(cy - lift) - 5, 4, 2, "#a8322a");
    p.rect(Math.round(cx) + 1, Math.round(cy - lift) - 7, 4, 1, "#d9d0c4");
  }
}

const style = (tier: Tier, draw: VenueStyle["draw"], overlay?: VenueStyle["overlay"]): VenueStyle => ({
  draw,
  overlay,
  labelLift: TIER_GEOM[tier].lift,
  reach: 14 + TIER_GEOM[tier].h * 12,
});

export function createVenueStyles(): Record<Tier, VenueStyle> {
  const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  let sparkClock = -1;

  function fest(p: Painter, v: VenueView, f: Frame): void {
    const [sx, sy] = v.at;
    const h = TIER_GEOM.fest.h;
    box(p, iso, sx - h - 1.0, sy + h - 1.0, 0.8, 0.8, 16, "#141010", "#221b1a", "#1a1413");
    box(p, iso, sx + h - 1.0, sy - h - 1.0, 0.8, 0.8, 16, "#141010", "#221b1a", "#1a1413");
    const fb = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 7, "#2b2222", "#3b2e2c", "#261d1c");
    const pl = [fb.D[0], fb.D[1] - 7] as const;
    const pr = [fb.B[0], fb.B[1] - 7] as const;
    p.rect(Math.round(pl[0]) - 1, Math.round(pl[1]) - 40, 2, 40, "#5e514c");
    p.rect(Math.round(pr[0]) - 1, Math.round(pr[1]) - 40, 2, 40, "#5e514c");
    p.line(Math.round(pl[0]), Math.round(pl[1]) - 40, Math.round(pr[0]), Math.round(pr[1]) - 40, 2, "#6f625c");
    for (let k = 1; k <= 4; k++) {
      const lx = pl[0] + ((pr[0] - pl[0]) * k) / 5;
      const ly = pl[1] + ((pr[1] - pl[1]) * k) / 5 - 40;
      const on = !f.motion || Math.sin(f.t * 4 + k * 1.3) > -0.3;
      p.rect(Math.round(lx) - 1, Math.round(ly) + 1, 3, 2, on ? (k % 2 ? "#ffb347" : "#ff6a2b") : "#3a2c28");
    }
    const w = 2 * h;
    for (let k = 0; k < 4; k++) {
      const u = (k + 0.8) / 4.6;
      performer(p, sx - h + w * u, sy + h - w * u, 7, f, k, k !== 2);
    }
    box(p, iso, sx - 0.6, sy - 0.6, 0.6, 0.6, 3, "#a8322a", "#7a241e", "#5c1b16");
  }

  function beams(p: Painter, v: VenueView, f: Frame): void {
    const [sx, sy] = v.at;
    const h = TIER_GEOM.fest.h;
    if (f.motion) {
      const pl = iso(sx - h, sy + h);
      const pr = iso(sx + h, sy - h);
      for (let k = 1; k <= 4; k++) {
        const lx = pl[0] + ((pr[0] - pl[0]) * k) / 5;
        const ly = pl[1] + ((pr[1] - pl[1]) * k) / 5 - 47;
        const a = Math.PI / 4 + Math.sin(f.t * 0.9 + k * 1.9) * 1.2;
        const rr = 6 + Math.sin(f.t * 0.6 + k) * 1.5;
        const [gx, gy] = iso(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        p.glow([lx, ly, gx - 16, gy, gx + 16, gy], k % 2 ? "#ffb347" : "#ff6a2b", 0.14);
      }
      if (Math.random() < 0.05) {
        for (const [cx, cy] of [iso(sx - h - 0.6, sy + h - 0.6), iso(sx + h - 0.6, sy - h - 0.6)]) {
          for (let k = 0; k < 10; k++) sparks.push({ x: cx, y: cy - 16, vx: (Math.random() - 0.5) * 18, vy: -30 - Math.random() * 40, life: 1 });
        }
      }
    }
    // Several festivals can share one particle pool; advance it once per frame.
    if (sparkClock !== f.t) {
      sparkClock = f.t;
      for (const s of sparks) {
        s.x += s.vx * f.dt;
        s.y += s.vy * f.dt;
        s.vy += 60 * f.dt;
        s.life -= f.dt * 1.1;
      }
      for (let k = sparks.length - 1; k >= 0; k--) if (sparks[k]!.life <= 0) sparks.splice(k, 1);
    }
    for (const s of sparks) p.rect(Math.round(s.x), Math.round(s.y), 1, 1, s.life > 0.5 ? "#ffe1a0" : "#ff6a2b");
  }

  return {
    busker: style("busker", (p, v, f) => {
      const [sx, sy] = v.at;
      diamond(p, ...iso(sx, sy), "#4a1f2a");
      box(p, iso, sx + 0.35, sy - 0.1, 0.5, 0.25, 2, "#1d1412", "#2b1e1b", "#221816");
      performer(p, sx, sy, 0, f, 1, true);
    }),
    tavern: style("tavern", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.tavern.h;
      const fb = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 13, "#4b2f28", "#5a3a2f", "#40291f");
      const apex = iso(sx, sy);
      const ay = apex[1] - 24;
      const tl = [fb.D[0], fb.D[1] - 13];
      const tc = [fb.C[0], fb.C[1] - 13];
      const tb = [fb.B[0], fb.B[1] - 13];
      p.poly([tl[0]!, tl[1]!, tc[0]!, tc[1]!, apex[0], ay], "#6e2b1f");
      p.poly([tc[0]!, tc[1]!, tb[0]!, tb[1]!, apex[0], ay], "#521f17");
      const mx = (fb.D[0] + fb.C[0]) / 2;
      const my = (fb.D[1] + fb.C[1]) / 2;
      p.rect(Math.round(mx) - 4, Math.round(my) - 9, 3, 3, "#ffb347");
      p.rect(Math.round(mx) + 2, Math.round(my) - 7, 3, 3, "#ffb347");
      const rx = (fb.B[0] + fb.C[0]) / 2;
      const ry = (fb.B[1] + fb.C[1]) / 2;
      p.rect(Math.round(rx) - 1, Math.round(ry) - 9, 3, 8, "#1a100c");
      performer(p, sx + h + 0.35, sy + h + 0.35, 0, f, 2, true);
    }),
    amph: style("amph", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.amph.h;
      box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 5, "#3e312e", "#4d3d39", "#322624");
      const e1 = iso(sx + h, sy + h);
      p.rect(Math.round(e1[0]) - 1, Math.round(e1[1]) - 5, 2, 1, "#ff6a2b");
      brazier(p, sx - h + 0.2, sy + h - 0.1, f, 9);
      brazier(p, sx + h - 0.1, sy - h + 0.2, f, 9);
      performer(p, sx - 0.45, sy + 0.45, 5, f, 1, true);
      performer(p, sx + 0.45, sy - 0.45, 5, f, 2, true);
      performer(p, sx - 0.3, sy - 0.3, 5, f, 3, false);
    }),
    fest: style("fest", fest, beams),
  };
}
