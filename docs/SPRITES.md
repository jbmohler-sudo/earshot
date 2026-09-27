# Sprites

Zones can draw pre-rendered pixel-art sprites instead of (or on top of) procedural art. Every sprite
keeps its procedural drawing as a fallback, so a missing, blocked or broken sheet never breaks a zone.

## Files

- `apps/web/public/sprites/<zone id>/<name>.png`: RGBA, transparent background, in art pixels (the
  world is drawn 1:1 in art pixels, then scaled up by the renderer).
- `apps/web/public/sprites/<zone id>/<name>.json`: the manifest.

```json
{ "frames": { "brazier": { "x": 0, "y": 0, "w": 48, "h": 64, "ax": 24, "ay": 64 } }, "animations": {} }
```

`(x, y, w, h)` is the frame's rect on the sheet. `(ax, ay)` is the anchor, in px from the frame's
top-left: the object's ground-contact point. The prop's draw depth (x + y of its tile) has to match that
ground point, or painter's-algorithm sorting goes wrong.

## How it fits together (app → zone → core)

- **core** (`packages/core/src/sprites.ts`): manifest types, `drawSprite(p, sheet, frame, x, y, alpha,
  fallback)`, and a tiny registry (`registerSheet` / `getSheet`). `Painter.sprite?()` is optional.
- **zone**: lists the sheets it wants in `ZonePlugin.sprites`, and draws each prop with
  `drawSprite(p, getSheet(zoneId, name), name, ...iso(x, y), 1, (p) => proceduralDrawing(p))`. Zones never
  import the app or a graphics library.
- **app** (`apps/web/lib/world/sprite-loader.ts`): the renderer calls `loadZoneSheets(zone.id,
  zone.sprites)` at startup. Each sheet is fetched (manifest first, then the PNG), decoded and registered.
  Failures resolve to null silently. The render loop redraws every frame, so a sprite appears on the
  first frame after its sheet lands.
- **painters**: `PixiPainter.sprite` appends a textured quad to the same `Graphics` stream
  (`Graphics.texture`, Pixi 8), so draw order is preserved. It sets the fill alpha explicitly first,
  because `texture()` inherits the alpha of the last `fill()`. `canvasPainter.sprite` uses `drawImage`.
  The renderer's `faded()` wrapper forwards `sprite` with its alpha multiplied.

To switch a wired sprite on or off, edit the zone's enabled list (`ENABLED_SPRITES` in its
`scenery.ts`). Tests in `zones/<zone>/sprites.test.ts` check manifests against the PNGs,
on-canvas placement, the no-sheet fallback and draw order.

## Art requirements

The world uses 16×8-pixel dimetric tiles (2:1, i.e. a camera at ~30° elevation and **45° azimuth**). A
person is about 12 px tall, and the procedural Forge building is 56 px wide and about 44 px tall.

- **Scale:** render every sprite at the same pixels-per-tile, so size follows the object. Don't
  normalize sheets to a fixed height.
- **Angle:** footprint edges should run along the tile diagonals (1 px down per 2 px across). A flat
  bottom edge means the object was rendered front-on.
- **Anchor:** the bottom-centre of a tight crop is only the ground point for footprints that are
  symmetric on screen. Otherwise set `ax`/`ay` to the real front ground corner.

### Forge set status (2026-09-27)

All six sheets were rendered through the Blender pixel pipeline
(`C:\Umbrella\_assets\_pipeline\`: orthographic camera at 26.565° elevation and 45° azimuth, 10.6 px
per metre, 8× supersample, box downscale, hard alpha, ≤12 colours), with anchors set to the projected
ground point. Props are true scale: `brazier` (9×13), `anvil` (8×11), `barrel` (8×12), `toolrack` (12×15).
`forge` (56×56, yawed 90°) is the Mixar model scaled 2.2×, long wall down the map's left edge, door facing the yard. Anchored on the footprint centre (`FORGE_AT` = 20, 28), along the bottom edge. It used to sit in the back-left corner (`FORGE_AT` = 3, 4.5, 56×48) and read as crowning the yard. The left wall is a venue row, so it doesn't go there either. `chimney` (16×60, a purpose-built 1.2 m × 5.6 m stack) is **retired**:
its PNG and manifest stay in `public/sprites/metal/`, but it's not in `SPRITES`, so the zone neither loads nor
draws it (a test guards this). The building keeps its own roof chimney and smoke. Five sheets are enabled.

### The Lot set status (2026-09-27)

`zones/indie` draws five sheets from `public/sprites/indie/`: `warehouse` (58×55, anchored on its 4.2×3
footprint centre, `WAREHOUSE_AT` = 3.1, 4.5), `lamp` (7×20, placed 8×), `dumpster` (12×12) and `crate` (8×8)
(18 seeded scatter spots, same RNG order as the procedural boxes), and `van` (27×20). Every sprite anchors on
its footprint centre, and all depths are unchanged. They were rendered with the pipeline's **fixed colour
path** (Standard view transform, correct sRGB→linear hex conversion, unit-strength emission) and
**face-tone mode**: each material gets the zone's three `box()` tones by face orientation (top / camera-left
/ camera-right) instead of lighting, then snaps to `lot_palette.json`. `check_palette.py` fails any sprite
missing its tones. The Forge set predates both fixes (its colours are what the old AgX path produced).

Glows stay procedural and are positioned from pixel offsets in `scenery.ts`: `LAMP_HEAD` (lit head, lamp.png
(1, 2) minus anchor) and `WAREHOUSE_DOOR` (roll-up door bottom-centre, warehouse.png (17, 48) minus
anchor). Re-rendered art must update those offsets. The freight train, puddles and rails stay procedural.
Tests: `zones/indie/sprites.test.ts`.

### The Hollow set status (2026-09-27)

`zones/folk` draws six sheets from `public/sprites/folk/`: `cabin` (60×54, anchored on its 4×3 footprint
centre, `CABIN_AT` = 3, 4.5, draw depth 7.9 so the door yard sorts in front), `pine_dark` and `pine_light`
(10×27, seeded scatter), `lantern` (6×14, placed 8×), `campfire` (12×11, the zone's drink station) and
`haybale` (14×12, placed 3×). Glows stay procedural: `LANTERN_HEAD` (lantern.png (1, 4) minus anchor) and
`CAMPFIRE_FLAME` (campfire.png (5, 0) minus anchor). Creek water, wildflowers, fireflies and sparks stay
procedural. Tests: `zones/folk/sprites.test.ts`.

### The Outskirts set status (2026-09-27)

`zones/outskirts` draws eight sheets from `public/sprites/outskirts/`: `motel` (56×40, anchored on its
4.4×2.6 footprint centre, `MOTEL_AT` = 3.2, 4.3, draw depth 11 so the door yard sorts in front),
`neon_sign` (15×38, its own prop at `SIGN_AT` = 5.9, 4.1), `water_tower` (18×39), `cactus_a` and `cactus_b`
(8×16, seeded scatter), `pickup` (24×17), `floodlight` (6×24, placed 7×) and `bar_counter` (14×16, the
zone's drink station). The painter can't tint a sprite, so the sign blinks by swapping the glowing sheet
for its dark procedural bars rather than recolouring pixels. `FLOOD_HEAD` (floodlight.png (3, 2) minus
anchor) keeps the light cone procedural. Highway cars stay procedural. Tests: `zones/outskirts/sprites.test.ts`.
