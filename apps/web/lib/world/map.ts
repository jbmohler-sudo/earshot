// The pixel world map: the four zones as landmarks on one small canvas (art pixels), joined by dotted
// roads. Used by the zone-travel transition now and by Phase 2's map/teleport later. Pure drawing
// through core's Painter, so it renders anywhere (canvas preview, PixiJS, tests).
import { drawPerson, type Look, type Painter } from "@earshot/core";

export const MAP_W = 160;
export const MAP_H = 96;

export interface Landmark {
  id: string;
  /** Where the road reaches the landmark (art px): avatars stand here. */
  x: number;
  y: number;
  /** Tint of the land around it. */
  ground: string;
}

/** Forge top-left, forest top-right, warehouse bottom-left, desert road bottom-right. */
export const LANDMARKS: Record<string, Landmark> = {
  metal: { id: "metal", x: 38, y: 36, ground: "#2a1a17" },
  folk: { id: "folk", x: 122, y: 34, ground: "#1b2a1c" },
  indie: { id: "indie", x: 40, y: 78, ground: "#25232c" },
  outskirts: { id: "outskirts", x: 120, y: 78, ground: "#3a3024" },
};

/** Roads: a ring through all four, plus the crossroads in the middle. */
export const ROADS: [string, string][] = [
  ["metal", "folk"],
  ["folk", "outskirts"],
  ["outskirts", "indie"],
  ["indie", "metal"],
  ["metal", "outskirts"],
  ["folk", "indie"],
];

/** Points along a straight dotted path from a to b, every `step` art px. */
export function dottedPath(a: Landmark, b: Landmark, step = 4): [number, number][] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.round(d / step));
  return Array.from({ length: n + 1 }, (_, k) => [Math.round(a.x + ((b.x - a.x) * k) / n), Math.round(a.y + ((b.y - a.y) * k) / n)]);
}

/**
 * Where a hopping avatar is at progress u (0..1) from a to b: `hops` parabolic arcs, `height` px tall.
 * Returns the foot position and whether it's mid-air.
 */
export function hopAt(a: Landmark, b: Landmark, u: number, hops = 4, height = 7): { x: number; y: number; air: boolean } {
  const t = Math.min(1, Math.max(0, u));
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const phase = (t * hops) % 1;
  const lift = t >= 1 ? 0 : Math.sin(phase * Math.PI) * height;
  return { x, y: y - lift, air: lift > 0.5 };
}

function block(p: Painter, x: number, y: number, w: number, h: number, top: string, side: string): void {
  p.rect(x, y, w, h, side);
  p.rect(x, y, w, 2, top);
}

function drawLandmark(p: Painter, id: string, t: number, motion: boolean): void {
  const L = LANDMARKS[id]!;
  const { x, y } = L;
  if (id === "metal") {
    // Forge with a chimney and a glowing door; lava seam behind.
    for (let k = 0; k < 18; k++) p.rect(x - 16 + k * 2, y - 14 + Math.round(Math.sin(k / 2) * 1.5), 2, 1, k % 2 ? "#ff6a2b" : "#ffb347");
    block(p, x - 7, y - 10, 14, 9, "#4a3430", "#5b3e36");
    p.rect(x + 3, y - 17, 3, 8, "#3d2b26");
    const glow = motion ? 0.75 + 0.25 * Math.sin(t * 6) : 1;
    p.rect(x - 2, y - 6, 3, 5, "#ff6a2b", glow);
    if (motion) p.rect(x + 4, y - 20 - Math.round((t * 4) % 4), 2, 2, "#6d5b63", 0.6);
  } else if (id === "folk") {
    // Pines and a creek.
    for (let k = 0; k < 14; k++) p.rect(x - 16 + k * 2, y - 16 + Math.round(Math.cos(k / 2)), 2, 1, "#3c6a8a");
    for (const [dx, h] of [[-8, 11], [-1, 14], [6, 10]] as const) {
      p.rect(x + dx, y - 2, 1, 2, "#4a3420");
      for (let r = 0; r < h - 2; r++) {
        const w = Math.max(1, Math.round(((h - 2 - r) / (h - 2)) * 4));
        p.rect(x + dx - w + 1, y - 3 - r, w * 2 - 1, 1, r % 3 ? "#274028" : "#2f4b30");
      }
    }
    if (motion && Math.sin(t * 3) > 0.6) p.rect(x + 10, y - 9, 1, 1, "#e8f07a");
  } else if (id === "indie") {
    // Brick warehouse, pink neon, rail line.
    p.line(x - 18, y - 13, x + 18, y - 13, 1, "#8a8490");
    block(p, x - 8, y - 11, 16, 10, "#6a3a34", "#52302b");
    const on = !motion || Math.sin(t * 5) > -0.7;
    p.rect(x - 4, y - 8, 8, 2, on ? "#ff5fa2" : "#4a2436");
    p.rect(x + 3, y - 5, 2, 2, "#ffd68c");
  } else {
    // Desert road with a cactus and a motel sign.
    p.rect(x - 18, y - 14, 36, 3, "#1e1e24");
    for (let k = 0; k < 5; k++) p.rect(x - 16 + k * 8, y - 13, 3, 1, "#e8c040");
    p.rect(x - 8, y - 9, 2, 8, "#3e6a3a");
    p.rect(x - 10, y - 6, 2, 1, "#3e6a3a");
    p.rect(x - 6, y - 7, 2, 1, "#3e6a3a");
    p.rect(x + 5, y - 11, 1, 10, "#4a4852");
    const on = !motion || Math.sin(t * 2.7) > -0.5;
    p.rect(x + 2, y - 13, 7, 3, on ? "#4fd1e0" : "#1f3a40");
  }
}

export interface MapFrame {
  t: number;
  motion: boolean;
  /** Highlight the road from → to (the trip being taken). */
  from?: string;
  to?: string;
  /** 0..1 progress of the hop along from → to. */
  progress?: number;
  look?: Look;
  /** Zone to mark as "you are here" when not travelling. */
  here?: string;
}

export function drawWorldMap(p: Painter, f: MapFrame): void {
  // Land: four tinted regions on a dark sea, softly checkered.
  p.rect(0, 0, MAP_W, MAP_H, "#0b0808");
  for (const L of Object.values(LANDMARKS)) {
    for (let yy = -22; yy < 20; yy += 2)
      for (let xx = -30; xx < 30; xx += 2) {
        if ((xx * xx) / 900 + (yy * yy) / 480 > 1) continue;
        p.rect(L.x + xx, L.y + yy - 6, 2, 2, L.ground, (xx + yy) % 4 === 0 ? 0.9 : 0.75);
      }
  }
  // Roads.
  for (const [a, b] of ROADS) {
    for (const [x, y] of dottedPath(LANDMARKS[a]!, LANDMARKS[b]!)) p.rect(x, y, 1, 1, "#5a4a44");
  }
  if (f.from && f.to && LANDMARKS[f.from] && LANDMARKS[f.to]) {
    const pts = dottedPath(LANDMARKS[f.from]!, LANDMARKS[f.to]!, 3);
    const lit = Math.round((f.progress ?? 0) * (pts.length - 1));
    pts.forEach(([x, y], k) => p.rect(x - (k <= lit ? 1 : 0), y, k <= lit ? 2 : 1, 1, k <= lit ? "#ffb347" : "#8a6a5a"));
  }
  for (const id of Object.keys(LANDMARKS)) drawLandmark(p, id, f.t, f.motion);

  // The traveller (or "you are here").
  if (f.look && f.from && f.to && LANDMARKS[f.from] && LANDMARKS[f.to]) {
    const h = hopAt(LANDMARKS[f.from]!, LANDMARKS[f.to]!, f.progress ?? 0);
    if (h.air) p.rect(Math.round(h.x) - 2, Math.round(LANDMARKS[f.from]!.y + (LANDMARKS[f.to]!.y - LANDMARKS[f.from]!.y) * (f.progress ?? 0)), 5, 1, "#000000", 0.35);
    drawPerson(p, h.x, h.y, f.look, 0, h.air ? 1 : 0, h.air);
  } else if (f.look && f.here && LANDMARKS[f.here]) {
    const L = LANDMARKS[f.here]!;
    drawPerson(p, L.x, L.y + 2, f.look);
  }
}
