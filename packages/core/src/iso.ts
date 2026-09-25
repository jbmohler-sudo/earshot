// Isometric projection: 16×8-pixel tiles. Tile (x, y) → art-pixel (px, py); draw order by x + y.

export const TILE_W = 16;
export const TILE_H = 8;

export interface Point {
  x: number;
  y: number;
}

export type Iso = (x: number, y: number) => [number, number];

/** iso(x, y) = [(x − y)·8 + OX, (x + y)·4 + OY] */
export function makeIso(origin: Point): Iso {
  return (x, y) => [((x - y) * TILE_W) / 2 + origin.x, ((x + y) * TILE_H) / 2 + origin.y];
}

/** Painter's-algorithm depth: larger draws later (in front). */
export function depth(x: number, y: number): number {
  return x + y;
}
