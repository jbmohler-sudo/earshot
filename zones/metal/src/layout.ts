// The Forge: a 32×32 basalt plain with a lava river along the back edge. Ported from Phase 0.
import type { TilePoint, ZoneLayout } from "@earshot/core";

export const N = 32;
const TW = 16;
const TH = 8;

export const layout: ZoneLayout = {
  size: N,
  pixels: { w: N * TW, h: N * TH + 70 + 20 },
  origin: { x: (N * TW) / 2, y: 70 },
  slots: [[9, 9], [23, 6], [5, 22], [22, 19], [13, 26], [27, 26], [28, 12]],
  plaza: { x0: 1.6, x1: 5.6, y0: 8.4, y1: 12.6 },
  bounds: { x0: 0.7, x1: N - 0.7, y0: 3.2, y1: N - 0.7 },
  spawnEdges: [
    { from: [N - 0.4, 4], to: [N - 0.4, N - 1] },
    { from: [2, N - 0.4], to: [N - 1, N - 0.4] },
  ],
  focus: [12.5, 12.5],
};

/** Lava river tiles along the back edge. */
export function riverTiles(): TilePoint[] {
  const tiles: TilePoint[] = [];
  for (let i = 0; i < N; i++) {
    const rj = Math.round(0.6 + 0.6 * Math.sin(i / 3));
    for (let j = 0; j <= rj + 1; j++) tiles.push([i, j]);
  }
  return tiles;
}

export function nearSlot(x: number, y: number, d: number): boolean {
  return layout.slots.some((s) => Math.hypot(s[0] - x, s[1] - y) < d);
}
