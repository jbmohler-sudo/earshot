# Brief: wire the Forge sprite set into Earshot

## Goal
The Forge (zone id `metal`, "The Forge · Metal") currently draws all its props
procedurally through the `Painter` interface. Replace six props with
Blender-rendered pixel-art sprites. Ship it live on earshot.world.

## What you're getting
- `sprites/metal/` — 6 PNGs + 6 JSON manifests, ready to drop into the repo.
  Each manifest has one frame covering the whole PNG; anchor (`ax`, `ay`) is
  bottom-center = the object's ground-contact point in art pixels.
- `reference/` — draft implementations from the art-pipeline design bundle
  (Sept 27). Use as a starting point, but verify against the CURRENT repo —
  the bundle is a draft and the repo has drifted since.

| sprite | px | source |
|---|---|---|
| brazier | 48×64 | Blender, flat-shaded, Forge palette |
| forge | 53×64 | Mixie-built blacksmith building, 2,125 tris, 8 flat materials |
| anvil | 68×64 | script-built, 178 tris, flat-shaded |
| barrel | 41×64 | quench barrel, wood + iron bands |
| chimney | 30×64 | tapered stone stack |
| toolrack | 41×64 | A-frame rack with hammer + tongs |

All are RGBA, transparent background, nearest-neighbor downscaled, quantized
to the Forge palette. They were rendered through an orthographic camera at the
game's exact dimetric angle (30° elevation, 45° azimuth), so they sit correctly
on the 16×8 iso tiles.

## Code changes

1. **`packages/core/src/painter.ts`** — add optional method to `Painter`:
   `sprite?(sheet: SpriteSheet, frame: string, x: number, y: number, alpha?: number): void;`
   (Optional so canvas/test painters that don't implement it keep working.)

2. **`packages/core/src/sprites.ts`** — NEW. Manifest types + `drawSprite()` with
   procedural fallback. Reference implementation in `reference/sprites.ts`.
   Key contract: `drawSprite(p, sheet, frame, x, y, alpha, fallback)` draws the
   frame with its anchor at art-pixel (x, y). If the sheet isn't loaded or the
   painter can't blit, it runs `fallback` (the existing procedural drawing) —
   so migration is per-prop, never flag day.

3. **`apps/web/lib/world/painters.ts`** — implement `sprite()` on `PixiPainter`:
   textured quad into the SAME `Graphics` stream (draw order preserved), with
   the magenta footprint fallback when the texture isn't available. Reference
   in `reference/painters.ts`. Note the `faded()` wrapper in
   `apps/web/lib/world/renderer.ts` must also forward `sprite` (reference shows
   the one-liner).

4. **`apps/web/lib/world/canvas-painter.ts`** — implement `sprite()` via
   `drawImage` (reference in `reference/canvas-painter.ts`). This backend is
   used for small previews; keep it working.

5. **`apps/web/lib/world/sprite-loader.ts`** — NEW. `loadSheet("metal", name)`
   fetches `/sprites/metal/<name>.png` + `.json`, caches. Reference in
   `reference/sprite-loader.ts`.

6. **Place the art**: copy `sprites/metal/*` to `apps/web/public/sprites/metal/`
   (12 files: 6 PNG + 6 JSON).

7. **`zones/metal/src/scenery.ts`** — wire the props. Pattern per prop:
   ```ts
   import { drawSprite } from "@earshot/core";
   import { loadSheet, type LoadedSheet } from "../../web/lib/world/sprite-loader"; // adjust path
   // module scope:
   let brazierSheet: LoadedSheet | null = null;
   loadSheet("metal", "brazier").then(s => { brazierSheet = s; }).catch(() => {});
   // in the prop:
   props.push({ depth: x + y, draw: (p, f) =>
     drawSprite(p, brazierSheet, "brazier", ...iso(x, y), 1,
       (p) => brazier(p, x, y, f, 7)) }); // existing procedural as fallback
   ```
   The render loop redraws every frame, so once the promise resolves the sprite
   appears on the next frame — no invalidation plumbing needed. If a sheet 404s
   or fails, the game keeps its current procedural look; nothing breaks.

## Prop placement (current procedural positions in `zones/metal/src/scenery.ts`)
- **forge** (building): replaces the big procedural prop at tiles (1,3),
  4×3 footprint, `depth: 12`. Anchor at the footprint's front-center ground
  point — start with `iso(3, 6)` and eyeball it against the old art.
- **brazier**: 8 positions in `BRAZIERS` — `[[6.6,8.2],[6.6,12.8],[1.2,13.4],
  [16.5,4.2],[30.4,18],[2.4,29.4],[19.5,30.4],[30.5,30.3]]`. Replace the
  `brazier()` procedural call; anchor at `iso(x, y)` for each.
- **anvil**: currently a tiny box "by the door" at tiles ~(3.75, 6.45).
  Anchor the sprite at `iso(4.1, 6.7)` — in front of the forge door.
- **chimney**: NEW prop. Place it behind the forge building, ~(5.2, 2.6),
  `depth: 5.2 + 2.6`. It's a standalone stack (the building has its own).
- **barrel**: NEW prop. Quench barrel in the forge yard, ~(2.2, 7.2).
- **toolrack**: NEW prop. Against the forge wall, ~(5.6, 5.2).
- Keep the existing procedural smoke particles in `overlay()` — they still work
  over the sprites.

Depth sorting is painter's algorithm by `depth: x + y`; anchors are ground
contact points, so sorting stays correct as long as each anchor sits on the
prop's ground tile.

## Verify
1. `pnpm typecheck`, `pnpm test` — all green.
2. Dev server, visit `/metal`. All six sprites visible; braziers at all 8 spots.
3. Walk the avatar behind and in front of the forge/anvil — sorting must be
   correct (avatar passes behind the building, in front of the chimney base).
4. Disable network for `/sprites/*` (devtools block) — the zone must fall back
   to the old procedural art with no errors. This proves the fallback contract.
5. Screenshot `/metal` before/after for Jeff.

## Ship
Commit, push, deploy (Vercel), then live-test on https://earshot.world/metal.
Confirm the sprites load (no 404s in the network tab) and the fallback still
works. Report back with the before/after screenshots and the live URL check.

## Non-goals
- Don't touch the other three zones. Don't redesign the pipeline. Don't add
  animations yet — these are all single static frames; the avatar rig comes next.
