# Addendum from zaino (CEO): read this BEFORE BRIEF.md

BRIEF.md is an external draft, dated before the repo drifted. I checked it against `main` @ 0e3e508. The corrections below override BRIEF.md wherever the two conflict.

## Verified drift and constraints
1. **Layering: zones must not import the web app.** `zones/metal/package.json` depends only on `@earshot/core`, and `packages/core/src/painter.ts` says zones "never import a graphics library". BRIEF step 7's `import { loadSheet } from "../../web/lib/world/sprite-loader"` breaks that rule. Do NOT import apps/web from a zone. Suggested shape: core owns a tiny sheet registry (`registerSheet(zone, name, sheet)` / `getSheet(zone, name): SpriteSheet | null`). apps/web loads sheets and registers them; zones call `getSheet("metal", "brazier")` each frame and pass the result to `drawSprite(...)` with the procedural fallback. Pick something equivalent if you find a cleaner seam, but it must keep the dependency direction app → zone → core.
2. **core must not mention music** (CLAUDE.md): no "artist", "track", "song" or "genre" in `packages/core`. Keep the sprite code generic.
3. **`faded()` in `apps/web/lib/world/renderer.ts` (lines ~17-24)** only forwards rect/poly/line/glow. Add `sprite`, forwarding with alpha multiplied (`a * alpha`). Otherwise faded props silently fall back to procedural art.
4. **PixiJS is 8.21.0.** Before relying on `Graphics.texture(...)`, confirm it exists and behaves as the reference assumes (textured quad in the same Graphics stream, so draw order is preserved). If it doesn't, find the correct 8.21 API. Do not silently ship the magenta footprint path.
5. **`docs/ART_PIPELINE.md` does not exist.** The reference comments point to it. Either drop those references or write a short doc; don't leave a dangling pointer.
6. The sprite art lives in `docs/work-orders/forge-sprites/sprites/metal/`. Copy it to `apps/web/public/sprites/metal/` (12 files).
7. **Tooling:** pnpm, run natively on Windows (see CLAUDE.md). The Vercel project root is `apps/web`.

## Gates (these override BRIEF.md "Ship")
- Work on branch `feat/forge-sprites` off `main`. Commit there. **Do NOT push, and do NOT deploy.** zaino verifies your hand-back, then merges and pushes.
- Required evidence in the hand-back:
  - `pnpm typecheck` and `pnpm test` exit codes and pass counts.
  - `pnpm build` exit code.
  - Dev-server screenshots of `/metal`, BEFORE (from `main`) and AFTER, saved as real PNG files under `docs/work-orders/forge-sprites/evidence/`. Give the paths. You must have captured them from a real browser (Playwright, or whatever is installed); prose descriptions don't count.
  - The fallback proof: an AFTER screenshot with `/sprites/*` blocked, showing the procedural art and zero console errors (paste the console output).
  - A depth-sorting note: whether the avatar or a walker passes correctly behind the building and in front of the chimney base. If you can't drive the avatar, say so plainly; don't claim it.
- Kill any dev servers you start before handing back, and report their PIDs.
- Hand-back: branch name, commit list, the evidence paths above, and anything you deviated on or couldn't do.
