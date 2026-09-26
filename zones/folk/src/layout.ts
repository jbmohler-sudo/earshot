// Provisional folk layout: the Forge's 32×32 geometry until step 8 gives this zone its own map and art.
// Pure data, so the poller (Deno) can import it for server-side layout.
import type { ZoneLayout } from "@earshot/core";

const N = 32;

export const layout: ZoneLayout = {
  size: N,
  pixels: { w: N * 16, h: N * 8 + 70 + 20 },
  origin: { x: (N * 16) / 2, y: 70 },
  slots: [[9, 9], [23, 6], [5, 22], [22, 19], [13, 26], [27, 26], [28, 12]],
  plaza: { x0: 1.6, x1: 5.6, y0: 8.4, y1: 12.6 },
  bounds: { x0: 0.7, x1: N - 0.7, y0: 3.2, y1: N - 0.7 },
  spawnEdges: [
    { from: [N - 0.4, 4], to: [N - 0.4, N - 1] },
    { from: [2, N - 0.4], to: [N - 1, N - 0.4] },
  ],
  focus: [12.5, 12.5],
};
