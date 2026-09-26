// The Forge's ground, lava, props and smoke. Ported from the Phase 0 prototype; the seeded RNG is
// consumed in the same order, so the map is identical.
import { box, diamond, type Frame, hex, makeIso, mulberry32, type Painter, type Prop, type ZoneScenery } from "@earshot/core";
import { layout, N, nearSlot, riverTiles } from "./layout.ts";

export const iso = makeIso(layout.origin);

interface Crack {
  px: [number, number][];
  ph: number;
}

export function brazier(p: Painter, x: number, y: number, f: Frame, h: number): void {
  box(p, iso, x - 0.2, y - 0.2, 0.4, 0.4, h, "#1a1210", "#3a2c28", "#2a1f1c");
  const [cx, cy] = iso(x, y);
  const fx = Math.round(cx);
  const fy = Math.round(cy) - h - 1;
  const fl = f.motion ? Math.sin(f.t * 13 + x * 3) * 0.5 + 0.5 : 1;
  p.rect(fx - 2, fy - 2, 4, 3, "#ff6a2b");
  p.rect(fx - 1, fy - 3 - Math.round(fl * 2), 2, 3, "#ffb347");
  p.rect(fx, fy - 2, 1, 1, "#fff0c2");
}

export function createScenery(): ZoneScenery {
  const R = mulberry32(4011);
  const river = riverTiles();
  const riverSet = new Set(river.map(([i, j]) => `${i},${j}`));

  // Ground tiles, speckles and glowing cracks, decided up front.
  const tones = ["#231a18", "#261c1a", "#201716", "#2a1f1c", "#1e1614"];
  const tiles: { cx: number; cy: number; tone: string; speck: number | null }[] = [];
  const cracks: Crack[] = [];
  for (let s = 0; s < 2 * N; s++) {
    for (let i = 0; i < N; i++) {
      const j = s - i;
      if (j < 0 || j >= N || riverSet.has(`${i},${j}`)) continue;
      const [cx, cy] = iso(i + 0.5, j + 0.5);
      const tone = tones[Math.floor(R() * tones.length)]!;
      const speck = R() < 0.08 ? Math.floor(R() * 4) : null;
      tiles.push({ cx, cy, tone, speck });
      if (R() < 0.07 && !nearSlot(i, j, 4.5) && j > 3) {
        const len = 3 + Math.floor(R() * 3);
        const dir = R() < 0.5 ? 1 : -1;
        const px: [number, number][] = [];
        for (let k = 0; k < len; k++) px.push([Math.round(cx) - 3 + k * 2 * dir * 0.5 + k, Math.round(cy) - 1 + (k % 2)]);
        cracks.push({ px, ph: R() * 6.28 });
      }
    }
  }

  const props: Prop[] = [];
  // The forge: house, roof, chimney, glowing door, anvil.
  props.push({
    depth: 12,
    draw(p, f) {
      const fg = box(p, iso, 1, 3, 4, 3, 24, "#4a3430", "#5b3e36", "#3c2a26");
      box(p, iso, 1.2, 3.2, 3.6, 2.6, 30, "#3a2622", "#4a3029", "#301f1c");
      box(p, iso, 4, 3.2, 0.8, 0.8, 44, "#2e211e", "#3d2b26", "#271c19");
      const mx = (fg.D[0] + fg.C[0]) / 2;
      const my = (fg.D[1] + fg.C[1]) / 2;
      const flick = f.motion ? 0.75 + 0.25 * Math.sin(f.t * 9) * Math.sin(f.t * 3.1) : 1;
      p.rect(Math.round(mx) - 3, Math.round(my) - 11, 5, 9, hex(255, 110 + 50 * flick, 43));
      p.rect(Math.round(mx) - 2, Math.round(my) - 9, 3, 6, "#ffb347", 0.9);
      box(p, iso, 3.75, 6.45, 0.7, 0.4, 5, "#6f625c", "#574b46", "#463c38"); // anvil by the door
    },
  });
  // Rocks, kept clear of venue slots and the forge yard.
  for (let k = 0; k < 26; k++) {
    const x = 0.5 + R() * (N - 1.5);
    const y = 3 + R() * (N - 4);
    if (nearSlot(x, y, 6.2)) continue;
    if (x < 7 && y < 13.5) continue;
    const w = 0.4 + R() * 0.6;
    const h = 3 + Math.floor(R() * 6);
    props.push({ depth: x + y, draw: (p) => void box(p, iso, x, y, w, w * 0.8, h, "#3b302d", "#2f2523", "#251d1b") });
  }
  // Braziers.
  const BRAZIERS: [number, number][] = [[6.6, 8.2], [6.6, 12.8], [1.2, 13.4], [16.5, 4.2], [30.4, 18], [2.4, 29.4], [19.5, 30.4], [30.5, 30.3]];
  for (const [x, y] of BRAZIERS) props.push({ depth: x + y, draw: (p, f) => brazier(p, x, y, f, 7) });

  const smoke: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  return {
    ground(p) {
      for (const tl of tiles) {
        diamond(p, tl.cx, tl.cy, tl.tone);
        if (tl.speck !== null) p.rect(Math.round(tl.cx) - 1 + tl.speck, Math.round(tl.cy) - 1, 2, 1, "#171110");
      }
      // Cliff faces along the two front edges.
      for (let i = 0; i < N; i++) {
        const L = iso(i, N);
        const Rr = iso(i + 1, N);
        p.poly([L[0], L[1], Rr[0], Rr[1], Rr[0], Rr[1] + 14, L[0], L[1] + 14], i % 2 ? "#2f1d17" : "#2a1914");
      }
      for (let j = 0; j < N; j++) {
        const T = iso(N, j);
        const B = iso(N, j + 1);
        p.poly([T[0], T[1], B[0], B[1], B[0], B[1] + 14, T[0], T[1] + 14], j % 2 ? "#1f1310" : "#1b110e");
      }
    },
    underlay(p, f) {
      for (const [i, j] of river) {
        const [cx, cy] = iso(i + 0.5, j + 0.5);
        const v = f.motion ? 0.5 + 0.5 * Math.sin(f.t * 1.4 + i * 0.9 + j * 1.3) : 0.5;
        diamond(p, cx, cy, hex(194 + 61 * v, 56 + 82 * v, 26 + 20 * v));
        if (f.motion && Math.sin(f.t * 2.3 + i * 5.1 + j * 7.7) > 0.93) p.rect(Math.round(cx) - 1 + ((i * 3) % 4), Math.round(cy) - 1, 2, 1, "#ffe1a0");
      }
      for (const c of cracks) {
        const a = f.motion ? 0.35 + (0.35 * (Math.sin(f.t * 1.7 + c.ph) + 1)) / 2 : 0.6;
        for (const [x, y] of c.px) p.rect(x, y, 1, 1, "#ff6a2b", a);
      }
    },
    props,
    overlay(p, f) {
      if (f.motion && Math.random() < 0.25) {
        const [cx, cy] = iso(4.4, 3.6);
        smoke.push({ x: cx, y: cy - 46, vx: 3 + Math.random() * 3, vy: -8 - Math.random() * 5, life: 1 });
      }
      for (const s of smoke) {
        s.x += s.vx * f.dt;
        s.y += s.vy * f.dt;
        s.life -= f.dt * 0.22;
      }
      for (let k = smoke.length - 1; k >= 0; k--) if (smoke[k]!.life <= 0) smoke.splice(k, 1);
      for (const s of smoke) {
        const size = 2 + Math.round((1 - s.life) * 3);
        p.rect(Math.round(s.x), Math.round(s.y), size, size, "#6d5b63", s.life * 0.5);
      }
    },
  };
}
