// The Lot: a warehouse district at dusk, rail tracks along the back edge. Pure data, so the poller
// (Deno) can import it for server-side layout.
import type { ZoneLayout } from "@earshot/core";

export const N = 32;

export const layout: ZoneLayout = {
  size: N,
  pixels: { w: N * 16, h: N * 8 + 70 + 20 },
  origin: { x: (N * 16) / 2, y: 70 },
  slots: [[10, 10], [23, 7], [5, 23], [21, 20], [13, 27], [27, 26], [28, 13]],
  plaza: { x0: 1.6, x1: 5.8, y0: 9, y1: 13 },
  bounds: { x0: 0.7, x1: N - 0.7, y0: 3.2, y1: N - 0.7 },
  spawnEdges: [
    { from: [N - 0.4, 4], to: [N - 0.4, N - 1] },
    { from: [2, N - 0.4], to: [N - 1, N - 0.4] },
  ],
  focus: [13, 13],
};

export function nearSlot(x: number, y: number, d: number): boolean {
  return layout.slots.some((s) => Math.hypot(s[0] - x, s[1] - y) < d);
}
