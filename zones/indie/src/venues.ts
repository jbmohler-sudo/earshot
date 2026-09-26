// The Lot's venue tiers: busker by an amp, record-shop bar, loading-dock stage, warehouse festival.
import { box, drawPerson, type Frame, type Look, type Painter, type Tier, type VenueStyle } from "@earshot/core";
import { iso, lamp } from "./scenery.ts";

const TIER_GEOM: Record<Tier, { h: number; lift: number }> = {
  busker: { h: 0.5, lift: 18 },
  tavern: { h: 1.0, lift: 32 },
  amph: { h: 1.5, lift: 24 },
  fest: { h: 2.4, lift: 58 },
};
const LOOKS: Look[] = [
  { skin: "#e8b896", hair: "#5a3a1e", long: false, shirt: "#efe4d6", print: "#1d2a3a", pants: "#2c3a5a" },
  { skin: "#b57a52", hair: "#15100e", long: true, shirt: "#ff5fa2", print: "#efe4d6", pants: "#23283a" },
  { skin: "#f1c7a5", hair: "#c9b18a", long: true, shirt: "#4fd1c5", print: "#1a1920", pants: "#2c3a5a" },
  { skin: "#8a5634", hair: "#2b1d15", long: false, shirt: "#1d2a3a", print: "#ffd68c", pants: "#15151a" },
];

function performer(p: Painter, x: number, y: number, lift: number, f: Frame, k: number, guitar: boolean): void {
  const [cx, cy] = iso(x, y);
  const bob = f.motion && Math.sin(f.t * 7 + k * 1.3) > 0.3 ? 1 : 0;
  drawPerson(p, cx, cy - lift, LOOKS[k % LOOKS.length]!, bob, 0, false);
  if (guitar) {
    p.rect(Math.round(cx) - 3, Math.round(cy - lift) - 5, 4, 2, k % 2 ? "#e0a030" : "#4fd1c5");
    p.rect(Math.round(cx) + 1, Math.round(cy - lift) - 7, 4, 1, "#d9d0c4");
  }
}

const style = (tier: Tier, draw: VenueStyle["draw"], overlay?: VenueStyle["overlay"]): VenueStyle => ({
  draw,
  overlay,
  labelLift: TIER_GEOM[tier].lift,
  reach: 14 + TIER_GEOM[tier].h * 12,
});

/** A string of bulbs between two art-pixel points, sagging in the middle. */
function bulbs(p: Painter, ax: number, ay: number, bx: number, by: number, f: Frame, n = 8): void {
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const x = ax + (bx - ax) * u;
    const y = ay + (by - ay) * u + Math.sin(u * Math.PI) * 4;
    const on = !f.motion || Math.sin(f.t * 3 + k) > -0.6;
    p.rect(Math.round(x), Math.round(y), 1, 1, on ? (k % 3 === 0 ? "#ff5fa2" : k % 3 === 1 ? "#ffd68c" : "#4fd1c5") : "#3a3842");
  }
}

export function createVenueStyles(): Record<Tier, VenueStyle> {
  const confetti: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  let clock = -1;

  return {
    busker: style("busker", (p, v, f) => {
      const [sx, sy] = v.at;
      box(p, iso, sx - 0.5, sy - 0.4, 0.8, 0.6, 1, "#5a2a3a", "#6a3348", "#4a2230"); // rug
      box(p, iso, sx + 0.4, sy - 0.3, 0.35, 0.3, 5, "#1a1920", "#2a2830", "#15141a"); // amp
      performer(p, sx, sy, 1, f, 0, true);
    }),
    tavern: style("tavern", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.tavern.h;
      const b = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 14, "#2e3a44", "#3a4a56", "#26303a");
      const mx = (b.D[0] + b.C[0]) / 2;
      const my = (b.D[1] + b.C[1]) / 2;
      // awning + neon "OPEN"-ish sign
      p.poly([b.D[0], b.D[1] - 10, b.C[0], b.C[1] - 10, b.C[0] + 2, b.C[1] - 6, b.D[0] + 2, b.D[1] - 6], "#ff5fa2");
      const on = !f.motion || Math.sin(f.t * 5) > -0.8;
      p.rect(Math.round(mx) - 4, Math.round(my) - 17, 8, 3, on ? "#4fd1c5" : "#2a4a48");
      p.rect(Math.round(mx) - 3, Math.round(my) - 5, 6, 4, "#ffd68c", 0.8);
      performer(p, sx + h + 0.35, sy + h + 0.35, 0, f, 1, true);
    }),
    amph: style("amph", (p, v, f) => {
      const [sx, sy] = v.at;
      const h = TIER_GEOM.amph.h;
      const b = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 6, "#4a4852", "#5a5862", "#3a3842"); // loading dock
      lamp(p, sx - h + 0.2, sy + h - 0.1, f, 14);
      lamp(p, sx + h - 0.1, sy - h + 0.2, f, 14);
      bulbs(p, b.D[0], b.D[1] - 20, b.B[0], b.B[1] - 20, f, 10);
      performer(p, sx - 0.45, sy + 0.45, 6, f, 0, true);
      performer(p, sx + 0.45, sy - 0.45, 6, f, 1, true);
      performer(p, sx - 0.3, sy - 0.3, 6, f, 2, false);
    }),
    fest: style(
      "fest",
      (p, v, f) => {
        const [sx, sy] = v.at;
        const h = TIER_GEOM.fest.h;
        const b = box(p, iso, sx - h, sy - h, 2 * h, 2 * h, 8, "#2a2830", "#3a3842", "#222028");
        const pl = [b.D[0], b.D[1] - 8] as const;
        const pr = [b.B[0], b.B[1] - 8] as const;
        p.rect(Math.round(pl[0]) - 1, Math.round(pl[1]) - 42, 2, 42, "#6a6874");
        p.rect(Math.round(pr[0]) - 1, Math.round(pr[1]) - 42, 2, 42, "#6a6874");
        p.line(Math.round(pl[0]), Math.round(pl[1]) - 42, Math.round(pr[0]), Math.round(pr[1]) - 42, 2, "#7a7884");
        bulbs(p, pl[0], pl[1] - 40, pr[0], pr[1] - 40, f, 16);
        // backdrop screen
        p.poly([pl[0] + 4, pl[1] - 36, pr[0] - 4, pr[1] - 36, pr[0] - 4, pr[1] - 10, pl[0] + 4, pl[1] - 10], "#1a1920");
        const w = 2 * h;
        for (let k = 0; k < 4; k++) {
          const u = (k + 0.8) / 4.6;
          performer(p, sx - h + w * u, sy + h - w * u, 8, f, k, k !== 1);
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
            const ly = pl[1] + ((pr[1] - pl[1]) * k) / 5 - 48;
            const a = Math.PI / 4 + Math.sin(f.t * 0.8 + k * 1.7) * 1.1;
            const [gx, gy] = iso(sx + Math.cos(a) * 6.5, sy + Math.sin(a) * 6.5);
            p.glow([lx, ly, gx - 16, gy, gx + 16, gy], k % 2 ? "#ff5fa2" : "#4fd1c5", 0.12);
          }
          if (Math.random() < 0.06) {
            const [cx, cy] = iso(sx, sy);
            for (let k = 0; k < 8; k++)
              confetti.push({ x: cx + (Math.random() - 0.5) * 30, y: cy - 50, vx: (Math.random() - 0.5) * 10, vy: 5 + Math.random() * 10, life: 1, c: ["#ff5fa2", "#4fd1c5", "#ffd68c"][k % 3]! });
          }
        }
        if (clock !== f.t) {
          clock = f.t;
          for (const c of confetti) {
            c.x += c.vx * f.dt + Math.sin(f.t * 3 + c.y) * 0.2;
            c.y += c.vy * f.dt;
            c.life -= f.dt * 0.35;
          }
          for (let k = confetti.length - 1; k >= 0; k--) if (confetti[k]!.life <= 0) confetti.splice(k, 1);
        }
        for (const c of confetti) p.rect(Math.round(c.x), Math.round(c.y), 1, 1, c.c);
      },
    ),
  };
}

