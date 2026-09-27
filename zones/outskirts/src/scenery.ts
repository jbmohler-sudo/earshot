// The Outskirts: sand, a highway with passing cars, cacti, a water tower, a neon motel sign. Eight props
// have pre-rendered sprites (/sprites/outskirts/*); each falls back to its procedural drawing while its
// sheet isn't loaded. The seeded RNG is consumed in the same order either way. Highway cars, light cones
// and the sign's blink stay procedural — the blink tints the sign sprite, it isn't baked in.
import { box, diamond, drawSprite, type Frame, getSheet, makeIso, mulberry32, type Painter, type Prop, type ZoneScenery } from "@earshot/core";
import { id } from "./claims.ts";
import { layout, N, nearSlot } from "./layout.ts";

export const iso = makeIso(layout.origin);

/** Sprite sheets the Outskirts is wired to draw (the app loads /sprites/outskirts/<name>.png + .json). */
export const SPRITES = ["motel", "neon_sign", "water_tower", "cactus_a", "cactus_b", "pickup", "floodlight", "bar_counter"] as const;
type SpriteName = (typeof SPRITES)[number];
export const ENABLED_SPRITES: readonly SpriteName[] = SPRITES;

/**
 * Draw a sprite anchored on tile (x, y) (its footprint centre), or `fallback` while its sheet isn't
 * loaded. Returns the anchor's screen point when the sprite drew, so callers can hang a procedural
 * effect on it; null when the fallback ran.
 */
function spriteAt(p: Painter, name: SpriteName, x: number, y: number, fallback: (p: Painter) => void): [number, number] | null {
  const [ax, ay] = iso(x, y);
  const sheet = getSheet(id, name);
  const drew = !!(sheet && sheet.manifest.frames[name] && p.sprite);
  drawSprite(p, sheet, name, ax, ay, 1, fallback);
  return drew ? [Math.round(ax), Math.round(ay)] : null;
}

// Pixel offsets from each sprite's anchor to a feature (feature px minus the manifest's ax/ay).
/** floodlight.png: 6×24, anchor (3, 23), white head at (3, 2). */
const FLOOD_HEAD: [number, number] = [3 - 3, 2 - 23];
/** The motel's 4.4 × 2.6 footprint at (1, 3); the sprite anchors on its centre. */
const MOTEL_AT: [number, number] = [1 + 4.4 / 2, 3 + 2.6 / 2];
/** The neon sign stands just off the motel's front-right corner, on its own so the blink can tint it. */
const SIGN_AT: [number, number] = [5.9, 4.1];

/** Floodlight tower: tall pole, white head, a faint cone. The cone is always procedural. */
export function floodlight(p: Painter, x: number, y: number, f: Frame, h = 22): void {
  const at = spriteAt(p, "floodlight", x, y, (p) => {
    box(p, iso, x - 0.1, y - 0.1, 0.2, 0.2, h, "#2a2830", "#4a4852", "#3a3842");
    const [cx, cy] = iso(x, y);
    const hx = Math.round(cx);
    const hy = Math.round(cy) - h - 3;
    p.rect(hx - 2, hy, 5, 3, "#e8f0f0");
    p.glow([hx, hy - 5, hx + 7, hy + 1, hx, hy + 7, hx - 7, hy + 1], "#e8f0f0", f.motion ? 0.16 : 0.12);
  });
  if (at) {
    const hx = at[0] + FLOOD_HEAD[0];
    const hy = at[1] + FLOOD_HEAD[1];
    p.glow([hx, hy - 5, hx + 7, hy + 1, hx, hy + 7, hx - 7, hy + 1], "#e8f0f0", f.motion ? 0.16 : 0.12);
  }
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
  // Motel: long low block, four doors, one lit. Its own draw depth, like the forge: the door yard
  // (y > 5.6) sorts in front of the wall. The sign is a separate prop so the blink can swap it.
  props.push({
    depth: 11,
    draw: (p) => void spriteAt(p, "motel", ...MOTEL_AT, (p) => procMotel(p)),
  });
  function procMotel(p: Painter): void {
    const m = box(p, iso, 1, 3, 4.4, 2.6, 14, "#6a5a48", "#8a7860", "#5a4c3c");
    for (let k = 0; k < 4; k++) {
      const u = (k + 0.6) / 4.4;
      const dx = m.D[0] + (m.C[0] - m.D[0]) * u;
      const dy = m.D[1] + (m.C[1] - m.D[1]) * u;
      p.rect(Math.round(dx) - 1, Math.round(dy) - 8, 3, 7, k === 2 ? "#ffd68c" : "#3a3024");
    }
  }
  // Neon sign, separate from the motel. The painter can't tint a sprite, so the blink swaps the
  // glowing sheet for the dark procedural bars (and back) rather than recolouring pixels.
  props.push({
    depth: SIGN_AT[0] + SIGN_AT[1],
    draw(p, f) {
      const on = !f.motion || Math.sin(f.t * 2.7) > -0.5;
      const sheet = getSheet(id, "neon_sign");
      const canBlit = !!(on && sheet && sheet.manifest.frames.neon_sign && p.sprite);
      if (canBlit) spriteAt(p, "neon_sign", ...SIGN_AT, () => {});
      else procSign(p, false, on);
    },
  });
  function procSign(p: Painter, cyan: boolean, amber: boolean): void {
    const [sx, sy] = iso(...SIGN_AT);
    p.rect(Math.round(sx) - 9, Math.round(sy) - 44, 18, 9, "#1a1920");
    p.rect(Math.round(sx) - 8, Math.round(sy) - 43, 16, 3, cyan ? "#4fd1e0" : "#1f3a40");
    p.rect(Math.round(sx) - 8, Math.round(sy) - 39, 16, 3, amber ? "#ffb347" : "#3a2c18");
  }
  // Water tower.
  props.push({
    depth: 26 + 4.5,
    draw: (p) => void spriteAt(p, "water_tower", 26.5, 5, (p) => procTower(p)),
  });
  function procTower(p: Painter): void {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) box(p, iso, 26 + dx, 4.5 + dy, 0.12, 0.12, 20, "#4a4852", "#5a5862", "#3a3842");
    const [cx, cy] = iso(26.5, 5);
    p.rect(Math.round(cx) - 7, Math.round(cy) - 32, 14, 12, "#7a7480");
    p.rect(Math.round(cx) - 7, Math.round(cy) - 34, 14, 2, "#9a94a0");
  }
  // Cacti and rocks, clear of venues and the plaza.
  for (let k = 0; k < 30; k++) {
    const x = 0.8 + R() * (N - 2);
    const y = 4 + R() * (N - 5);
    const h = 8 + Math.floor(R() * 8);
    const rock = R() < 0.4;
    const cactusName: SpriteName = R() < 0.5 ? "cactus_a" : "cactus_b";
    if (nearSlot(x, y, 6) || (x < 7.5 && y < 14.5)) continue;
    props.push({
      depth: x + y,
      draw: (p) => (rock ? void box(p, iso, x, y, 0.6, 0.5, 4, "#5a4a3a", "#6a5846", "#4a3c30") : void spriteAt(p, cactusName, x, y, (p) => cactus(p, x, y, h))),
    });
  }
  // Parked pickup.
  props.push({ depth: 15 + 4.2, draw: (p) => void spriteAt(p, "pickup", 15 + 0.8, 4.2 + 0.4, (p) => void box(p, iso, 15, 4.2, 1.6, 0.8, 7, "#8a3a2a", "#a8483a", "#6e2e20")) });
  // Bar counter: the zone's drink station. Procedural box until its sheet loads.
  const BAR_AT: [number, number] = [7.4, 6.2];
  props.push({
    depth: BAR_AT[0] + BAR_AT[1],
    draw: (p) => void spriteAt(p, "bar_counter", ...BAR_AT, (p) => procBar(p)),
  });
  function procBar(p: Painter): void {
    box(p, iso, BAR_AT[0] - 0.7, BAR_AT[1] - 0.25, 1.4, 0.5, 6, "#5a4c3c", "#8a7860", "#6a5a48");
    const [cx, cy] = iso(...BAR_AT);
    p.rect(Math.round(cx) - 3, Math.round(cy) - 9, 1, 3, "#2a6a62");
    p.rect(Math.round(cx) + 1, Math.round(cy) - 8, 1, 2, "#1e4a48");
  }
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
