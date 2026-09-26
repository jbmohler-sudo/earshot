// The Outskirts' venue tiers: busker off a tailgate, roadside diner, drive-in screen, lot festival.
import { box, drawPerson, type Frame, type Look, type Painter, type Tier, type VenueStyle } from "@earshot/core";
import { floodlight, iso } from "./scenery.ts";

const TIER_GEOM: Record<Tier, { h: number; lift: number }> = {
  busker: { h: 0.5, lift: 18 },
  tavern: { h: 1.0, lift: 30 },
  amph: { h: 1.5, lift: 44 },
  fest: { h: 2.4, lift: 60 },
};
const LOOKS: Look[] = [
  { skin: "#d9a47c", hair: "#15100e", long: false, shirt: "#4fd1e0", print: "#1a1920", pants: "#23283a" },
  { skin: "#8a5634", hair: "#2b1d15", long: true, shirt: "#ffb347", print: "#1a1920", pants: "#15151a" },
  { skin: "#f1c7a5", hair: "#d4d0c8", long: false, shirt: "#efe4d6", print: "#8a3a2a", pants: "#2c3a5a" },
  { skin: "#5e3a24", hair: "#15100e", long: true, shirt: "#8a3a2a", print: "#ffb347", pants: "#23283a" },
];

function performer(p: Painter, x: number, y: number, lift: number, f: Frame, k: number, mic: boolean): void {
  const [cx, cy] = iso(x, y);
  const bob = f.motion && Math.sin(f.t * 8 + k * 1.5) > 0.2 ? 1 : 0;
  drawPerson(p, cx, cy - lift, LOOKS[k % LOOKS.length]!, bob, 0, !mic && f.motion && Math.sin(f.t * 1.1 + k) > 0.6);
  if (mic) p.rect(Math.round(cx) + 3, Math.round(cy - lift) - 9, 1, 9, "#8a8490");
}

const style = (tier: Tier, draw: VenueStyle["draw"], overlay?: VenueStyle["overlay"]): VenueStyle => ({
  draw,
  overlay,
  labelLift: TIER_GEOM[tier].lift,
  reach: 14 + TIER_GEOM[tier].h * 12,
});

export function createVenueStyles(): Record<Tier, VenueStyle> {
  const dust: { x: number; y: number; vx: number; life: number }[] = [];
  let clock = -1;

  return {
    busker: style("busker", (p, v, f) => {
      const [sx, sy] = v.at;
      box(p, iso, sx - 1.1, sy - 0.8, 1.4, 0.7, 6, "#3a5a8a", "#4a6a9a", "#2e4a70"); // pickup bed
      performer(p, sx, sy, 0, f, 0, true);
    }),
    tavern: style("tavern", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.tavern.h;
      const d = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 11, "#c9c4b8", "#e0dbd0", "#a8a398"); // diner
      p.line(d.D[0], d.D[1] - 6, d.C[0], d.C[1] - 6, 2, "#8a3a2a");
      const mx = (d.D[0] + d.C[0]) / 2;
      const my = (d.D[1] + d.C[1]) / 2;
      for (let k = -1; k <= 1; k++) p.rect(Math.round(mx) + k * 5 - 2, Math.round(my) - 10, 3, 3, "#ffd68c", 0.9);
      const on = !f.motion || Math.sin(f.t * 3.3) > -0.6;
      p.rect(Math.round(mx) - 6, Math.round(my) - 20, 12, 4, on ? "#ff5fa2" : "#3a1e2a");
      performer(p, sx + h + 0.35, sy + h + 0.35, 0, f, 1, true);
    }),
    amph: style("amph", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.amph.h;
      const s = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 4, "#4a4852", "#5a5862", "#3a3842");
      // Drive-in screen standing along the stage's back edge (A→B), facing the crowd.
      const [ax, ay] = [s.A[0], s.A[1] - 4];
      const [bx, by] = [s.B[0], s.B[1] - 4];
      p.poly([ax - 1, ay + 1, bx + 1, by + 1, bx + 1, by - 25, ax - 1, ay - 25], "#1a1920"); // frame
      const glow = f.motion ? 0.7 + 0.2 * Math.sin(f.t * 1.7) : 0.8;
      p.poly([ax + 1, ay - 3, bx - 1, by - 3, bx - 1, by - 23, ax + 1, ay - 23], "#9ab4c0", glow);
      p.glow([ax + 1, ay - 3, bx - 1, by - 3, bx - 1, by - 23, ax + 1, ay - 23], "#4fd1e0", 0.08);
      floodlight(p, sx - h + 0.2, sy + h - 0.1, f, 16);
      performer(p, sx - 0.45, sy + 0.45, 4, f, 0, true);
      performer(p, sx + 0.45, sy - 0.45, 4, f, 1, false);
      performer(p, sx - 0.3, sy - 0.3, 4, f, 2, false);
    }),
    fest: style(
      "fest",
      (p, v, f) => {
        const [sx, sy] = v.at;
        const h = TIER_GEOM.fest.h;
        box(p, iso, sx - h - 1.0, sy + h - 1.0, 0.8, 0.8, 16, "#141418", "#222228", "#1a1a20");
        box(p, iso, sx + h - 1.0, sy - h - 1.0, 0.8, 0.8, 16, "#141418", "#222228", "#1a1a20");
        const b = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 7, "#2a2830", "#3a3842", "#222028");
        const pl = [b.D[0], b.D[1] - 7] as const;
        const pr = [b.B[0], b.B[1] - 7] as const;
        p.rect(Math.round(pl[0]) - 1, Math.round(pl[1]) - 44, 2, 44, "#6a6874");
        p.rect(Math.round(pr[0]) - 1, Math.round(pr[1]) - 44, 2, 44, "#6a6874");
        p.line(Math.round(pl[0]), Math.round(pl[1]) - 44, Math.round(pr[0]), Math.round(pr[1]) - 44, 2, "#7a7884");
        for (let k = 1; k <= 4; k++) {
          const lx = pl[0] + ((pr[0] - pl[0]) * k) / 5;
          const ly = pl[1] + ((pr[1] - pl[1]) * k) / 5 - 44;
          const on = !f.motion || Math.sin(f.t * 5 + k * 1.1) > -0.3;
          p.rect(Math.round(lx) - 1, Math.round(ly) + 1, 3, 2, on ? (k % 2 ? "#4fd1e0" : "#ffb347") : "#3a3842");
        }
        const w = 2 * h;
        for (let k = 0; k < 4; k++) {
          const u = (k + 0.8) / 4.6;
          performer(p, sx - h + w * u, sy + h - w * u, 7, f, k, k === 1);
        }
      },
      (p, v, f) => {
        const [sx, sy] = v.at;
        const h = TIER_GEOM.fest.h;
        if (f.motion) {
          const pl = iso(sx - h, sy + h);
          const pr = iso(sx + h, sy - h);
          for (let k = 1; k <= 4; k++) {
            const lx = pl[0] + ((pr[0] - pl[0]) * k) / 5;
            const ly = pl[1] + ((pr[1] - pl[1]) * k) / 5 - 51;
            const a = Math.PI / 4 + Math.sin(f.t * 1.1 + k * 1.6) * 1.3;
            const [gx, gy] = iso(sx + Math.cos(a) * 6, sy + Math.sin(a) * 6);
            p.glow([lx, ly, gx - 15, gy, gx + 15, gy], k % 2 ? "#4fd1e0" : "#ffb347", 0.13);
          }
          if (Math.random() < 0.15) {
            const [cx, cy] = iso(sx + 2, sy + 2);
            dust.push({ x: cx + (Math.random() - 0.5) * 50, y: cy - Math.random() * 6, vx: 4 + Math.random() * 6, life: 1 });
          }
        }
        if (clock !== f.t) {
          clock = f.t;
          for (const d of dust) {
            d.x += d.vx * f.dt;
            d.y -= f.dt * 2;
            d.life -= f.dt * 0.5;
          }
          for (let k = dust.length - 1; k >= 0; k--) if (dust[k]!.life <= 0) dust.splice(k, 1);
        }
        for (const d of dust) p.rect(Math.round(d.x), Math.round(d.y), 2, 1, "#a8946e", d.life * 0.4);
      },
    ),
  };
}
