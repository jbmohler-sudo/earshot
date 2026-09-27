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

To switch a wired sprite on or off, edit the zone's enabled list (`ENABLED_SPRITES` in
`zones/metal/src/scenery.ts`). Tests in `zones/metal/sprites.test.ts` check manifests against the PNGs,
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

All six sheets are enabled. `brazier` (9×13), `anvil` (8×11), `barrel` (8×12) and `toolrack` (12×15) were
re-rendered at game scale through the Blender pixel pipeline (`C:\Umbrella\_assets\_pipeline\`:
orthographic camera at 26.565° elevation and 45° azimuth, 10.6 px per metre, 8× supersample, box
downscale, hard alpha, ≤12 colours), with anchors set to the projected ground point. `forge` (53×64) and
`chimney` (30×64) are still the original front-on renders (flat bottom edges). They read acceptably, but
a 45° re-render would sit better on the tiles.
