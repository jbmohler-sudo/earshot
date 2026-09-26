// The Lot: concrete, rail tracks, a brick warehouse, street lamps, neon puddles. Placeholder art.
import { box, diamond, type Frame, hex, makeIso, mulberry32, type Painter, type Prop, type ZoneScenery } from "@earshot/core";
import { layout, N, nearSlot } from "./layout.ts";

export const iso = makeIso(layout.origin);

/** Street lamp: pole plus a warm head that hums. */
export function lamp(p: Painter, x: number, y: number, f: Frame, h = 16): void {
  box(p, iso, x - 0.1, y - 0.1, 0.2, 0.2, h, "#1b1a20", "#3a3842", "#2a2830");
  const [cx, cy] = iso(x, y);
  const hx = Math.round(cx);
  const hy = Math.round(cy) - h - 2;
  const hum = f.motion ? 0.85 + 0.15 * Math.sin(f.t * 7 + x) : 1;
  p.rect(hx - 2, hy, 5, 2, "#2a2830");
  p.rect(hx - 1, hy + 2, 3, 1, hex(255, 214 * hum, 140 * hum));
  p.glow([hx, hy - 4, hx + 6, hy + 1, hx, hy + 6, hx - 6, hy + 1], "#ffd68c", 0.18 * hum);
}

export function createScenery(): ZoneScenery {
  const R = mulberry32(7331);
  const railRows = new Set<string>();
  for (let i = 0; i < N; i++) for (let j = 0; j <= 2; j++) railRows.add(`${i},${j}`);

  const tones = ["#26242c", "#2a2830", "#232129", "#2d2b33", "#211f27"];
  const tiles: { cx: number; cy: number; tone: string; mark: number | null }[] = [];
  const puddles: { cx: number; cy: number; ph: number; pink: boolean }[] = [];
  for (let s = 0; s < 2 * N; s++) {
    for (let i = 0; i < N; i++) {
      const j = s - i;
      if (j < 0 || j >= N || railRows.has(`${i},${j}`)) continue;
      const [cx, cy] = iso(i + 0.5, j + 0.5);
      tiles.push({ cx, cy, tone: tones[Math.floor(R() * tones.length)]!, mark: R() < 0.05 ? Math.floor(R() * 3) : null });
      if (R() < 0.035 && !nearSlot(i, j, 4) && j > 4) puddles.push({ cx, cy, ph: R() * 6.28, pink: R() < 0.5 });
    }
  }

  const props: Prop[] = [];
  // The warehouse: brick box, roll-up door glowing, roof vents.
  props.push({
    depth: 11,
    draw(p, f) {
      const w = box(p, iso, 1, 3, 4.2, 3, 26, "#4a2c28", "#6a3a34", "#52302b");
      box(p, iso, 1.6, 3.4, 0.7, 0.7, 32, "#3a3842", "#4a4852", "#2e2c34");
      box(p, iso, 3.4, 3.6, 0.7, 0.7, 31, "#3a3842", "#4a4852", "#2e2c34");
      const mx = (w.D[0] + w.C[0]) / 2;
      const my = (w.D[1] + w.C[1]) / 2;
      const flick = f.motion ? 0.8 + 0.2 * Math.sin(f.t * 2.3) : 1;
      p.rect(Math.round(mx) - 5, Math.round(my) - 12, 10, 10, hex(255 * flick, 95 * flick, 162 * flick), 0.9);
      for (let k = 0; k < 4; k++) p.rect(Math.round(mx) - 5, Math.round(my) - 12 + k * 3, 10, 1, "#1a1920", 0.5);
      // windows along the right face
      for (let k = 0; k < 3; k++) {
        const u = (k + 0.7) / 3.4;
        const wx = w.B[0] + (w.C[0] - w.B[0]) * u;
        const wy = w.B[1] + (w.C[1] - w.B[1]) * u;
        p.rect(Math.round(wx) - 1, Math.round(wy) - 18, 3, 4, (k + Math.floor(f.t / 3)) % 3 ? "#ffd68c" : "#2a2830");
      }
    },
  });
  // Dumpsters and crates, clear of venues and the plaza.
  for (let k = 0; k < 18; k++) {
    const x = 0.8 + R() * (N - 2);
    const y = 4 + R() * (N - 5);
    if (nearSlot(x, y, 6) || (x < 7.5 && y < 14.5)) continue;
    const big = R() < 0.4;
    const color = big ? ["#2e5a4c", "#3b6e5e", "#244a3e"] : ["#6a5238", "#7d6242", "#584430"];
    props.push({ depth: x + y, draw: (p) => void box(p, iso, x, y, big ? 1 : 0.5, big ? 0.6 : 0.5, big ? 7 : 4, color[0]!, color[1]!, color[2]!) });
  }
  // Parked van.
  props.push({ depth: 16 + 4.5, draw: (p) => void box(p, iso, 16, 4.5, 1.8, 0.9, 9, "#c9c4b8", "#e0dbd0", "#a8a398") });
  // Street lamps.
  const LAMPS: [number, number][] = [[6.8, 8.4], [6.8, 13.6], [16, 3.8], [30.4, 18], [2.4, 29.4], [19.5, 30.4], [30.5, 30.3], [12, 17]];
  for (const [x, y] of LAMPS) props.push({ depth: x + y, draw: (p, f) => lamp(p, x, y, f) });

  const trains: { u: number }[] = [];
  let nextTrain = 6;

  return {
    ground(p) {
      for (const tl of tiles) {
        diamond(p, tl.cx, tl.cy, tl.tone);
        if (tl.mark !== null) p.rect(Math.round(tl.cx) - 3 + tl.mark, Math.round(tl.cy), 6, 1, "#4a4852");
      }
      // Rail bed: gravel with two rails and sleepers.
      for (let i = 0; i < N; i++) {
        for (let j = 0; j <= 2; j++) {
          const [cx, cy] = iso(i + 0.5, j + 0.5);
          diamond(p, cx, cy, (i + j) % 2 ? "#3a3432" : "#36302e");
        }
        const [ax, ay] = iso(i, 1.1);
        const [bx, by] = iso(i + 1, 1.1);
        p.line(ax, ay, bx, by, 1, "#8a8490");
        const [cx2, cy2] = iso(i, 1.9);
        const [dx, dy] = iso(i + 1, 1.9);
        p.line(cx2, cy2, dx, dy, 1, "#8a8490");
        const [sx, sy] = iso(i + 0.5, 1.5);
        p.rect(Math.round(sx) - 3, Math.round(sy), 6, 1, "#4a3a30");
      }
      for (let i = 0; i < N; i++) {
        const L = iso(i, N);
        const Rr = iso(i + 1, N);
        p.poly([L[0], L[1], Rr[0], Rr[1], Rr[0], Rr[1] + 14, L[0], L[1] + 14], i % 2 ? "#2c2a32" : "#28262e");
      }
      for (let j = 0; j < N; j++) {
        const T = iso(N, j);
        const B = iso(N, j + 1);
        p.poly([T[0], T[1], B[0], B[1], B[0], B[1] + 14, T[0], T[1] + 14], j % 2 ? "#1e1c24" : "#1b1a20");
      }
    },
    underlay(p, f) {
      // A freight train rolls along the back every so often (drawn first: it's the farthest thing).
      if (f.motion) {
        nextTrain -= f.dt;
        if (nextTrain <= 0) {
          trains.push({ u: -8 });
          nextTrain = 25 + Math.random() * 25;
        }
      }
      for (const t of trains) t.u += f.dt * 5;
      for (let k = trains.length - 1; k >= 0; k--) if (trains[k]!.u > N + 2) trains.splice(k, 1);
      for (const t of trains) {
        for (let c = 0; c < 6; c++) {
          const x = t.u - c * 1.3;
          if (x < -1.5 || x > N) continue;
          box(p, iso, x, 1.05, 1.2, 0.9, 9, c === 0 ? "#3b6e5e" : "#5a4a3e", c === 0 ? "#4b8a76" : "#6e5a4a", c === 0 ? "#2e5a4c" : "#4a3c32");
        }
      }
      for (const d of puddles) {
        const a = f.motion ? 0.25 + 0.2 * Math.sin(f.t * 1.3 + d.ph) : 0.35;
        p.rect(Math.round(d.cx) - 3, Math.round(d.cy) - 1, 6, 2, d.pink ? "#ff5fa2" : "#4fd1c5", a);
      }
    },
    props,
  };
}
