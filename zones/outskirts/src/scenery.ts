// The Outskirts: sand, a highway with passing cars, cacti, a water tower, a neon motel sign. Placeholder art.
import { box, diamond, type Frame, makeIso, mulberry32, type Painter, type Prop, type ZoneScenery } from "@earshot/core";
import { layout, N, nearSlot } from "./layout.ts";

export const iso = makeIso(layout.origin);

/** Floodlight tower: tall pole, white head, a faint cone. */
export function floodlight(p: Painter, x: number, y: number, f: Frame, h = 22): void {
  box(p, iso, x - 0.1, y - 0.1, 0.2, 0.2, h, "#2a2830", "#4a4852", "#3a3842");
  const [cx, cy] = iso(x, y);
  const hx = Math.round(cx);
  const hy = Math.round(cy) - h - 3;
  p.rect(hx - 2, hy, 5, 3, "#e8f0f0");
  p.glow([hx, hy - 5, hx + 7, hy + 1, hx, hy + 7, hx - 7, hy + 1], "#e8f0f0", f.motion ? 0.16 : 0.12);
}

export function cactus(p: Painter, x: number, y: number, h: number): void {
  const [cx, cy] = iso(x, y);
  const bx = Math.round(cx);
  const by = Math.round(cy);
  p.rect(bx - 1, by - h, 3, h, "#3e6a3a");
  p.rect(bx, by - h, 1, h, "#4e7e46");
  p.rect(bx - 4, by - h + 5, 3, 2, "#3e6a3a");
  p.rect(bx - 4, by - h + 2, 2, 4, "#3e6a3a");
  p.rect(bx + 2, by - h + 7, 3, 2, "#3e6a3a");
  p.rect(bx + 3, by - h + 4, 2, 4, "#3e6a3a");
}

export function createScenery(): ZoneScenery {
  const R = mulberry32(6060);
  const tones = ["#3a3226", "#3e3529", "#362e23", "#42382b", "#332b21"];
  const tiles: { cx: number; cy: number; tone: string; pebble: number | null }[] = [];
  for (let s = 0; s < 2 * N; s++) {
    for (let i = 0; i < N; i++) {
      const j = s - i;
      if (j < 0 || j >= N || j <= 2) continue;
      const [cx, cy] = iso(i + 0.5, j + 0.5);
      tiles.push({ cx, cy, tone: tones[Math.floor(R() * tones.length)]!, pebble: R() < 0.1 ? Math.floor(R() * 4) : null });
    }
  }

  const props: Prop[] = [];
  // Motel: long low block, doors, and a blinking neon sign on a pole.
  props.push({
    depth: 11,
    draw(p, f) {
      const m = box(p, iso, 1, 3, 4.4, 2.6, 14, "#6a5a48", "#8a7860", "#5a4c3c");
      for (let k = 0; k < 4; k++) {
        const u = (k + 0.6) / 4.4;
        const dx = m.D[0] + (m.C[0] - m.D[0]) * u;
        const dy = m.D[1] + (m.C[1] - m.D[1]) * u;
        p.rect(Math.round(dx) - 1, Math.round(dy) - 8, 3, 7, k === 2 ? "#ffd68c" : "#3a3024");
      }
      box(p, iso, 5.8, 4, 0.2, 0.2, 30, "#2a2830", "#4a4852", "#3a3842");
      const [sx, sy] = iso(5.9, 4.1);
      const on = !f.motion || Math.sin(f.t * 2.7) > -0.5;
      const flick = f.motion && Math.sin(f.t * 31) > 0.95;
      p.rect(Math.round(sx) - 9, Math.round(sy) - 44, 18, 9, "#1a1920");
      p.rect(Math.round(sx) - 8, Math.round(sy) - 43, 16, 3, on && !flick ? "#4fd1e0" : "#1f3a40");
      p.rect(Math.round(sx) - 8, Math.round(sy) - 39, 16, 3, on ? "#ffb347" : "#3a2c18");
    },
  });
  // Water tower.
  props.push({
    depth: 26 + 4.5,
    draw(p) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) box(p, iso, 26 + dx, 4.5 + dy, 0.12, 0.12, 20, "#4a4852", "#5a5862", "#3a3842");
      // Tank on the legs, with a lighter cap.
      const [cx, cy] = iso(26.5, 5);
      p.rect(Math.round(cx) - 7, Math.round(cy) - 32, 14, 12, "#7a7480");
      p.rect(Math.round(cx) - 7, Math.round(cy) - 34, 14, 2, "#9a94a0");
    },
  });
  // Cacti and rocks, clear of venues and the plaza.
  for (let k = 0; k < 30; k++) {
    const x = 0.8 + R() * (N - 2);
    const y = 4 + R() * (N - 5);
    const h = 8 + Math.floor(R() * 8);
    const rock = R() < 0.4;
    if (nearSlot(x, y, 6) || (x < 7.5 && y < 14.5)) continue;
    props.push({
      depth: x + y,
      draw: (p) => (rock ? void box(p, iso, x, y, 0.6, 0.5, 4, "#5a4a3a", "#6a5846", "#4a3c30") : cactus(p, x, y, h)),
    });
  }
  // Parked pickup.
  props.push({ depth: 15 + 4.2, draw: (p) => void box(p, iso, 15, 4.2, 1.6, 0.8, 7, "#8a3a2a", "#a8483a", "#6a2e20") });
  // Floodlights.
  const LIGHTS: [number, number][] = [[7, 8.4], [7, 13.6], [16.5, 3.8], [30.4, 18], [2.4, 29.4], [19.5, 30.4], [30.5, 30.3]];
  for (const [x, y] of LIGHTS) props.push({ depth: x + y, draw: (p, f) => floodlight(p, x, y, f) });

  const cars: { u: number; dir: 1 | -1; color: string }[] = [];
  let nextCar = 3;

  return {
    ground(p) {
      for (const tl of tiles) {
        diamond(p, tl.cx, tl.cy, tl.tone);
        if (tl.pebble !== null) p.rect(Math.round(tl.cx) - 2 + tl.pebble, Math.round(tl.cy), 1, 1, "#2a241a");
      }
      // Highway: asphalt, shoulder lines, dashed center.
      for (let i = 0; i < N; i++) {
        for (let j = 0; j <= 2; j++) {
          const [cx, cy] = iso(i + 0.5, j + 0.5);
          diamond(p, cx, cy, (i + j) % 2 ? "#1e1e24" : "#202028");
        }
        const [ax, ay] = iso(i, 2.9);
        const [bx, by] = iso(i + 1, 2.9);
        p.line(ax, ay, bx, by, 1, "#c9c4b8");
        if (i % 2 === 0) {
          const [cx, cy] = iso(i + 0.2, 1.5);
          const [dx, dy] = iso(i + 0.8, 1.5);
          p.line(cx, cy, dx, dy, 1, "#e8c040");
        }
      }
      for (let i = 0; i < N; i++) {
        const L = iso(i, N);
        const Rr = iso(i + 1, N);
        p.poly([L[0], L[1], Rr[0], Rr[1], Rr[0], Rr[1] + 14, L[0], L[1] + 14], i % 2 ? "#4a3e2e" : "#443828");
      }
      for (let j = 0; j < N; j++) {
        const T = iso(N, j);
        const B = iso(N, j + 1);
        p.poly([T[0], T[1], B[0], B[1], B[0], B[1] + 14, T[0], T[1] + 14], j % 2 ? "#342a1e" : "#30271c");
      }
    },
    underlay(p, f) {
      // Cars on the highway (drawn first: it's the farthest thing).
      if (f.motion) {
        nextCar -= f.dt;
        if (nextCar <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          cars.push({ u: dir === 1 ? -2 : N + 2, dir, color: ["#8a3a2a", "#3a5a8a", "#c9c4b8", "#2a2a30"][Math.floor(Math.random() * 4)]! });
          nextCar = 4 + Math.random() * 8;
        }
      }
      for (const c of cars) c.u += c.dir * f.dt * 6;
      for (let k = cars.length - 1; k >= 0; k--) if (cars[k]!.u < -3 || cars[k]!.u > N + 3) cars.splice(k, 1);
      for (const c of cars) {
        const lane = c.dir === 1 ? 2 : 0.9;
        box(p, iso, c.u, lane, 1.1, 0.55, 5, c.color, c.color, "#15151a");
        const [hx, hy] = iso(c.dir === 1 ? c.u + 1.1 : c.u, lane + 0.3);
        p.rect(Math.round(hx) - 1, Math.round(hy) - 3, 2, 1, "#fff0c2");
        p.glow([hx, hy - 3, hx + c.dir * 18, hy - 12, hx + c.dir * 18, hy + 6], "#fff0c2", 0.06);
      }
    },
    props,
  };
}
