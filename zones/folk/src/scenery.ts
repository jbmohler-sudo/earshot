// The Hollow: grass, wildflowers, a creek, pines, a cabin, lanterns and a campfire. Placeholder art.
import { box, diamond, type Frame, hex, makeIso, mulberry32, type Painter, type Prop, type ZoneScenery } from "@earshot/core";
import { layout, N, nearSlot } from "./layout.ts";

export const iso = makeIso(layout.origin);

export function creekTiles(): [number, number][] {
  const tiles: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const rj = Math.round(0.8 + 0.7 * Math.sin(i / 4 + 1));
    for (let j = 0; j <= rj + 1; j++) tiles.push([i, j]);
  }
  return tiles;
}

/** Lantern on a post: warm, flickering. */
export function lantern(p: Painter, x: number, y: number, f: Frame, h = 10): void {
  box(p, iso, x - 0.1, y - 0.1, 0.2, 0.2, h, "#3a2a1c", "#5a4028", "#4a3420");
  const [cx, cy] = iso(x, y);
  const lx = Math.round(cx);
  const ly = Math.round(cy) - h - 3;
  const fl = f.motion ? 0.8 + 0.2 * Math.sin(f.t * 11 + x * 2) : 1;
  p.rect(lx - 1, ly, 3, 3, hex(255 * fl, 190 * fl, 90 * fl));
  p.rect(lx - 1, ly - 1, 3, 1, "#2a2016");
  p.glow([lx - 5, ly - 3, lx + 6, ly - 3, lx + 6, ly + 7, lx - 5, ly + 7], "#ffbe5a", 0.08);
}

export function pine(p: Painter, x: number, y: number, h: number, dark: boolean): void {
  const [cx, cy] = iso(x, y);
  const bx = Math.round(cx);
  const by = Math.round(cy);
  p.rect(bx - 1, by - 4, 2, 4, "#4a3420");
  const greens = dark ? ["#16261a", "#1c3020", "#23392a"] : ["#1e3322", "#274028", "#2f4b30"];
  for (let k = 0; k < 3; k++) {
    const top = by - 4 - h * (k + 1) * 0.36;
    const w = 7 - k * 2;
    p.poly([bx - w, by - 4 - h * k * 0.3, bx + w, by - 4 - h * k * 0.3, bx, top], greens[k]!);
  }
}

export function createScenery(): ZoneScenery {
  const R = mulberry32(5150);
  const creek = creekTiles();
  const creekSet = new Set(creek.map(([i, j]) => `${i},${j}`));

  const tones = ["#1f2a1c", "#223020", "#1c2619", "#25331f", "#1a2417"];
  const tiles: { cx: number; cy: number; tone: string; flower: string | null }[] = [];
  for (let s = 0; s < 2 * N; s++) {
    for (let i = 0; i < N; i++) {
      const j = s - i;
      if (j < 0 || j >= N || creekSet.has(`${i},${j}`)) continue;
      const [cx, cy] = iso(i + 0.5, j + 0.5);
      const flower = R() < 0.06 ? (R() < 0.5 ? "#d9c46a" : "#e8e4d0") : null;
      tiles.push({ cx, cy, tone: tones[Math.floor(R() * tones.length)]!, flower });
    }
  }

  const props: Prop[] = [];
  // Cabin with a lit window and a chimney.
  props.push({
    depth: 11,
    draw(p, f) {
      const c = box(p, iso, 1, 3, 4, 3, 18, "#5a4028", "#6e4e30", "#4a3420");
      const apex = iso(3, 4.5);
      const t = [c.D[0], c.D[1] - 18];
      const m = [c.C[0], c.C[1] - 18];
      const r = [c.B[0], c.B[1] - 18];
      p.poly([t[0]!, t[1]!, m[0]!, m[1]!, apex[0], apex[1] - 34], "#3a2a1c");
      p.poly([m[0]!, m[1]!, r[0]!, r[1]!, apex[0], apex[1] - 34], "#2a1e14");
      box(p, iso, 4, 3.3, 0.6, 0.6, 38, "#4a4040", "#5a5050", "#3a3232");
      const mx = (c.D[0] + c.C[0]) / 2;
      const my = (c.D[1] + c.C[1]) / 2;
      const fl = f.motion ? 0.85 + 0.15 * Math.sin(f.t * 6) : 1;
      p.rect(Math.round(mx) - 2, Math.round(my) - 12, 4, 4, hex(255 * fl, 190 * fl, 90 * fl));
    },
  });
  // Pines, thick at the edges, clear of venues, the plaza and the cabin yard.
  for (let k = 0; k < 44; k++) {
    const x = 0.6 + R() * (N - 1.2);
    const y = 3.5 + R() * (N - 4.2);
    const h = 18 + Math.floor(R() * 14);
    const dark = R() < 0.5;
    if (nearSlot(x, y, 6.4) || (x < 8 && y < 15)) continue;
    props.push({ depth: x + y, draw: (p) => pine(p, x, y, h, dark) });
  }
  // Hay bales.
  for (const [x, y] of [[8.2, 14.2], [17, 13.5], [15.5, 20]] as [number, number][]) {
    props.push({ depth: x + y, draw: (p) => void box(p, iso, x, y, 0.8, 0.5, 5, "#c9a24a", "#d8b45a", "#a8863a") });
  }
  // Lanterns.
  const LANTERNS: [number, number][] = [[7, 8.6], [7, 13.4], [1.6, 13.8], [17, 4.2], [30.4, 18.5], [3, 29.4], [19, 30.4], [30.4, 30.3]];
  for (const [x, y] of LANTERNS) props.push({ depth: x + y, draw: (p, f) => lantern(p, x, y, f) });
  // Campfire in the plaza: stones, logs, flames.
  const [fx, fy] = [4, 11];
  props.push({
    depth: fx + fy,
    draw(p, f) {
      const [cx, cy] = iso(fx, fy);
      const x = Math.round(cx);
      const y = Math.round(cy);
      for (let k = 0; k < 6; k++) p.rect(x - 5 + ((k * 7) % 11), y - 1 + (k % 2), 2, 1, "#5a5050");
      p.rect(x - 3, y - 2, 6, 1, "#4a3420");
      const fl = f.motion ? Math.sin(f.t * 12) * 0.5 + 0.5 : 0.5;
      p.rect(x - 2, y - 5, 4, 3, "#ff8a2b");
      p.rect(x - 1, y - 7 - Math.round(fl * 2), 2, 3, "#ffd06a");
      p.glow([x - 12, y - 10, x + 12, y - 10, x + 12, y + 4, x - 12, y + 4], "#ff9a3a", 0.07);
    },
  });

  const sparks: { x: number; y: number; vy: number; life: number }[] = [];
  const fireflies = Array.from({ length: 14 }, () => ({ x: 4 + R() * 26, y: 5 + R() * 25, ph: R() * 6.28 }));

  return {
    ground(p) {
      for (const tl of tiles) {
        diamond(p, tl.cx, tl.cy, tl.tone);
        if (tl.flower) p.rect(Math.round(tl.cx), Math.round(tl.cy) - 1, 1, 1, tl.flower);
      }
      for (let i = 0; i < N; i++) {
        const L = iso(i, N);
        const Rr = iso(i + 1, N);
        p.poly([L[0], L[1], Rr[0], Rr[1], Rr[0], Rr[1] + 14, L[0], L[1] + 14], i % 2 ? "#3a2a1c" : "#34261a");
      }
      for (let j = 0; j < N; j++) {
        const T = iso(N, j);
        const B = iso(N, j + 1);
        p.poly([T[0], T[1], B[0], B[1], B[0], B[1] + 14, T[0], T[1] + 14], j % 2 ? "#2a1e14" : "#261b12");
      }
    },
    underlay(p, f) {
      for (const [i, j] of creek) {
        const [cx, cy] = iso(i + 0.5, j + 0.5);
        const v = f.motion ? 0.5 + 0.5 * Math.sin(f.t * 1.1 - i * 0.7 + j * 1.1) : 0.5;
        diamond(p, cx, cy, hex(36 + 20 * v, 70 + 30 * v, 92 + 40 * v));
        if (f.motion && Math.sin(f.t * 2 + i * 4.1 + j * 6.3) > 0.94) p.rect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 1, "#cfe6f0");
      }
    },
    props,
    overlay(p, f) {
      if (f.motion && Math.random() < 0.2) {
        const [cx, cy] = iso(fx, fy);
        sparks.push({ x: cx + (Math.random() - 0.5) * 4, y: cy - 8, vy: -12 - Math.random() * 10, life: 1 });
      }
      for (const s of sparks) {
        s.y += s.vy * f.dt;
        s.x += Math.sin(s.y * 0.3) * 0.2;
        s.life -= f.dt * 0.8;
      }
      for (let k = sparks.length - 1; k >= 0; k--) if (sparks[k]!.life <= 0) sparks.splice(k, 1);
      for (const s of sparks) p.rect(Math.round(s.x), Math.round(s.y), 1, 1, s.life > 0.5 ? "#ffd06a" : "#ff8a2b");
      if (!f.motion) return;
      for (const ff of fireflies) {
        const x = ff.x + Math.sin(f.t * 0.4 + ff.ph) * 1.2;
        const y = ff.y + Math.cos(f.t * 0.3 + ff.ph * 2) * 1.2;
        const [cx, cy] = iso(x, y);
        if (Math.sin(f.t * 1.7 + ff.ph * 3) > 0.2) p.rect(Math.round(cx), Math.round(cy) - 14, 1, 1, "#e8f07a", 0.9);
      }
    },
  };
}
