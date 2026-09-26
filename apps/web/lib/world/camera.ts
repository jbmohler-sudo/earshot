// Camera maths for the world view, pure so tests can ask "what's on screen by default?".
// camX/camY: where the art canvas's (0, 0) lands on screen; S: integer zoom (screen px per art px).
import { makeIso, type TilePoint, type ZoneLayout } from "@earshot/core";

export interface Camera {
  S: number;
  camX: number;
  camY: number;
}

/** Initial zoom for a stage of cw × ch screen px: as big as fits a ~300 × 190 art-px window, 2..5. */
export function fitZoom(cw: number, ch: number): number {
  return Math.max(2, Math.min(5, Math.floor(Math.min(cw / 300, ch / 190))));
}

/** Keep the map on screen (centered if it's smaller than the stage, else at most 60 px of margin). */
export function clampCamera(c: Camera, layout: ZoneLayout, cw: number, ch: number): Camera {
  const W = layout.pixels.w * c.S;
  const H = layout.pixels.h * c.S;
  const m = 60;
  return {
    S: c.S,
    camX: W < cw ? (cw - W) / 2 : Math.min(m, Math.max(cw - W - m, c.camX)),
    camY: H < ch ? (ch - H) / 2 : Math.min(m, Math.max(ch - H - m, c.camY)),
  };
}

/** Center the camera on a tile at zoom S. */
export function centerCamera(layout: ZoneLayout, S: number, at: TilePoint, cw: number, ch: number): Camera {
  const [lx, ly] = makeIso(layout.origin)(at[0], at[1]);
  return clampCamera({ S, camX: cw / 2 - lx * S, camY: ch / 2 - ly * S }, layout, cw, ch);
}

/** The view someone gets on arrival: fitted zoom, centered on the zone's focus. */
export function defaultCamera(layout: ZoneLayout, cw: number, ch: number): Camera {
  return centerCamera(layout, fitZoom(cw, ch), layout.focus, cw, ch);
}

/** Is a person standing on this tile fully on screen (feet to head, ~14 art px tall)? */
export function inView(c: Camera, layout: ZoneLayout, cw: number, ch: number, tile: TilePoint): boolean {
  const [lx, ly] = makeIso(layout.origin)(tile[0], tile[1]);
  const x = c.camX + lx * c.S;
  const feet = c.camY + (ly + 1) * c.S;
  const head = c.camY + (ly - 14) * c.S;
  const half = 5 * c.S;
  return x - half >= 0 && x + half <= cw && head >= 0 && feet <= ch;
}

/** Typical stage sizes: the world canvas in a 1280 × 800 window, and on a 375 × 812 phone. */
export const STAGE_DESKTOP = { cw: 906, ch: 730 };
export const STAGE_PHONE = { cw: 343, ch: 503 };
