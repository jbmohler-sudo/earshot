// The Hollow's venue tiers: busker on a stump, log-cabin tavern, hay-bale stage, barn festival.
import { box, drawPerson, type Frame, type Look, type Painter, type Tier, type VenueStyle } from "@earshot/core";
import { iso, lantern } from "./scenery.ts";

const TIER_GEOM: Record<Tier, { h: number; lift: number }> = {
  busker: { h: 0.5, lift: 18 },
  tavern: { h: 1.0, lift: 36 },
  amph: { h: 1.5, lift: 24 },
  fest: { h: 2.4, lift: 62 },
};
const LOOKS: Look[] = [
  { skin: "#e8b896", hair: "#8b6a3e", long: true, shirt: "#6a3a2a", print: "#c9a24a", pants: "#3a3a4a" },
  { skin: "#b57a52", hair: "#2b1d15", long: false, shirt: "#2f4a2a", print: "#e8e4d0", pants: "#4a3420" },
  { skin: "#f1c7a5", hair: "#c9b18a", long: true, shirt: "#c9a24a", print: "#6a3a2a", pants: "#2c3a5a" },
  { skin: "#8a5634", hair: "#15100e", long: false, shirt: "#4a4a5a", print: "#e8e4d0", pants: "#4a3420" },
];
const INSTRUMENT = ["#b8844a", "#d8a860", "#8a5a30", "#c9944e"];

function performer(p: Painter, x: number, y: number, lift: number, f: Frame, k: number, instrument: boolean): void {
  const [cx, cy] = iso(x, y);
  const bob = f.motion && Math.sin(f.t * 5 + k * 1.9) > 0.4 ? 1 : 0;
  drawPerson(p, cx, cy - lift, LOOKS[k % LOOKS.length]!, bob, 0, false);
  if (instrument) {
    p.rect(Math.round(cx) - 3, Math.round(cy - lift) - 5, 4, 3, INSTRUMENT[k % INSTRUMENT.length]!);
    p.rect(Math.round(cx) + 1, Math.round(cy - lift) - 6, 4, 1, "#e8e4d0");
  }
}

const style = (tier: Tier, draw: VenueStyle["draw"], overlay?: VenueStyle["overlay"]): VenueStyle => ({
  draw,
  overlay,
  labelLift: TIER_GEOM[tier].lift,
  reach: 14 + TIER_GEOM[tier].h * 12,
});

function lanternString(p: Painter, ax: number, ay: number, bx: number, by: number, f: Frame, n = 8): void {
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const x = ax + (bx - ax) * u;
    const y = ay + (by - ay) * u + Math.sin(u * Math.PI) * 5;
    const fl = f.motion ? 0.75 + 0.25 * Math.sin(f.t * 9 + k * 1.3) : 1;
    p.rect(Math.round(x), Math.round(y), 2, 2, fl > 0.8 ? "#ffd06a" : "#ffbe5a");
  }
}

export function createVenueStyles(): Record<Tier, VenueStyle> {
  const embers: { x: number; y: number; vy: number; life: number }[] = [];
  let clock = -1;

  return {
    busker: style("busker", (p, v, f) => {
      const [sx, sy] = v.at;
      box(p, iso, sx - 0.25, sy - 0.25, 0.5, 0.5, 3, "#8a6a40", "#6e4e30", "#5a4028"); // stump
      performer(p, sx, sy, 3, f, 0, true);
      box(p, iso, sx + 0.4, sy + 0.1, 0.35, 0.2, 2, "#3a2a1c", "#4a3420", "#2a1e14"); // open case
    }),
    tavern: style("tavern", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.tavern.h;
      const c = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 13, "#5a4028", "#6e4e30", "#4a3420");
      for (let k = 1; k < 4; k++) {
        const y = k * 3;
        p.line(c.D[0], c.D[1] - y, c.C[0], c.C[1] - y, 1, "#4a3420");
      }
      const apex = iso(sx, sy);
      const t = [c.D[0], c.D[1] - 13];
      const m = [c.C[0], c.C[1] - 13];
      const r = [c.B[0], c.B[1] - 13];
      p.poly([t[0]!, t[1]!, m[0]!, m[1]!, apex[0], apex[1] - 26], "#3a2a1c");
      p.poly([m[0]!, m[1]!, r[0]!, r[1]!, apex[0], apex[1] - 26], "#2a1e14");
      const mx = (c.D[0] + c.C[0]) / 2;
      const my = (c.D[1] + c.C[1]) / 2;
      p.rect(Math.round(mx) - 2, Math.round(my) - 8, 4, 4, "#ffbe5a");
      lantern(p, sx + h + 0.3, sy - h + 0.4, f, 9);
      performer(p, sx + h + 0.35, sy + h + 0.35, 0, f, 1, true);
    }),
    amph: style("amph", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.amph.h;
      const s = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 5, "#8a6a40", "#9a7a4a", "#6e5030"); // plank stage
      for (let k = 1; k < 5; k++) {
        const u = k / 5;
        p.line(s.A[0] + (s.B[0] - s.A[0]) * u, s.A[1] - 5 + (s.B[1] - s.A[1]) * u, s.D[0] + (s.C[0] - s.D[0]) * u, s.D[1] - 5 + (s.C[1] - s.D[1]) * u, 1, "#6e5030");
      }
      box(p, iso, sx - h - 0.9, sy + h - 0.6, 0.8, 0.5, 5, "#c9a24a", "#d8b45a", "#a8863a");
      box(p, iso, sx + h - 0.6, sy - h - 0.9, 0.5, 0.8, 5, "#c9a24a", "#d8b45a", "#a8863a");
      lantern(p, sx - h + 0.2, sy + h - 0.1, f, 12);
      lantern(p, sx + h - 0.1, sy - h + 0.2, f, 12);
      performer(p, sx - 0.45, sy + 0.45, 5, f, 0, true);
      performer(p, sx + 0.45, sy - 0.45, 5, f, 1, true);
      performer(p, sx - 0.3, sy - 0.3, 5, f, 2, false);
    }),
    fest: style(
      "fest",
      (p, v, f) => {
        const [sx, sy] = v.at;
        const h = TIER_GEOM.fest.h;
        // Open-fronted barn: floor, two gable posts, a roof ridge.
        const b = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 7, "#6e5030", "#8a6a40", "#5a4028");
        const pl = [b.D[0], b.D[1] - 7] as const;
        const pr = [b.B[0], b.B[1] - 7] as const;
        const back = [b.A[0], b.A[1] - 7] as const;
        p.poly([pl[0], pl[1] - 34, back[0], back[1] - 34, back[0], back[1] - 56], "#6a3a2a");
        p.poly([back[0], back[1] - 34, pr[0], pr[1] - 34, back[0], back[1] - 56], "#5a2e20");
        p.poly([pl[0], pl[1], back[0], back[1], back[0], back[1] - 34, pl[0], pl[1] - 34], "#5a2e20", 0.9);
        p.poly([back[0], back[1], pr[0], pr[1], pr[0], pr[1] - 34, back[0], back[1] - 34], "#4a2418", 0.9);
        p.rect(Math.round(pl[0]) - 1, Math.round(pl[1]) - 34, 2, 34, "#3a2a1c");
        p.rect(Math.round(pr[0]) - 1, Math.round(pr[1]) - 34, 2, 34, "#3a2a1c");
        lanternString(p, pl[0], pl[1] - 32, pr[0], pr[1] - 32, f, 14);
        const w = 2 * h;
        for (let k = 0; k < 4; k++) {
          const u = (k + 0.8) / 4.6;
          performer(p, sx - h + w * u, sy + h - w * u, 7, f, k, k !== 3);
        }
      },
      (p, v, f) => {
        const [sx, sy] = v.at;
        const h = TIER_GEOM.fest.h;
        if (f.motion) {
          const pl = iso(sx - h, sy + h);
          const pr = iso(sx + h, sy - h);
          for (let k = 1; k <= 3; k++) {
            const lx = pl[0] + ((pr[0] - pl[0]) * k) / 4;
            const ly = pl[1] + ((pr[1] - pl[1]) * k) / 4 - 38;
            const a = Math.PI / 4 + Math.sin(f.t * 0.5 + k * 2.1) * 0.8;
            const [gx, gy] = iso(sx + Math.cos(a) * 6, sy + Math.sin(a) * 6);
            p.glow([lx, ly, gx - 18, gy, gx + 18, gy], "#ffbe5a", 0.08);
          }
          if (Math.random() < 0.1) {
            const [cx, cy] = iso(sx, sy);
            embers.push({ x: cx + (Math.random() - 0.5) * 36, y: cy - 30, vy: -8 - Math.random() * 8, life: 1 });
          }
        }
        if (clock !== f.t) {
          clock = f.t;
          for (const e of embers) {
            e.y += e.vy * f.dt;
            e.x += Math.sin(e.y * 0.2) * 0.3;
            e.life -= f.dt * 0.4;
          }
          for (let k = embers.length - 1; k >= 0; k--) if (embers[k]!.life <= 0) embers.splice(k, 1);
        }
        for (const e of embers) p.rect(Math.round(e.x), Math.round(e.y), 1, 1, "#e8f07a", e.life);
      },
    ),
  };
}
