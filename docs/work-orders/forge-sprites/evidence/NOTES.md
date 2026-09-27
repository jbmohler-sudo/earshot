# Forge sprites: evidence

Captured 2026-09-26 with Playwright 1.63 (Chromium 1228, headless, 1440×900) against `next dev` on
http://localhost:3100/metal, signed out, live presence (the zone was empty). Each capture saved:

- `<label>.png`: the browser viewport.
- `<label>-world.png`: the full world texture in art pixels (512×346), from the dev handle
  `window.__earshot`.
- `<label>-forge-x4.png`: the forge yard cropped from the world texture, ×4 nearest-neighbour.
- `<label>-console.txt`: every console message, page error, failed request and HTTP ≥ 400 response.

| label | what |
| --- | --- |
| `before-main` | Branch head before any code change (identical to `main` @ 0e3e508; 0330a92 only adds docs) |
| `after` | The committed state: forge + chimney sprites enabled |
| `after-all-six-native` | All six sprites enabled at native size, exactly per BRIEF.md (not committed as the default; see below) |
| `after-sprites-blocked` | The committed state with `**/sprites/**` aborted by Playwright (the fallback proof) |
| `compare-before-after-fallback.png` | Forge yard side by side: before / after / blocked |
| `depth-probe-after.png`, `depth-probe-depth12-vs-7.9.png`, `depth-probe-numbers.json` | Depth sorting (below) |

## Fallback proof (`after-sprites-blocked`)

Sheets requested: forge.json and chimney.json, both blocked. The PNGs were never requested (manifest
first). The zone renders the procedural building, door glow and anvil, with no magenta placeholders and
no leftover sprites (`compare-before-after-fallback.png`). Console output, verbatim:

```
[console.info] %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold
[console.log] [HMR] connected
[requestfailed] http://localhost:3100/sprites/metal/forge.json net::ERR_BLOCKED_BY_CLIENT.Inspector
[console.error] Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
[requestfailed] http://localhost:3100/sprites/metal/chimney.json net::ERR_BLOCKED_BY_CLIENT.Inspector
[console.error] Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
```

Zero page errors (uncaught exceptions), and zero errors logged by app code. The two
`console.error` lines are Chrome's own network log entries for the two blocked requests. Chrome
prints one for any blocked request (DevTools request blocking does the same), and page code can't
suppress them. There is no Pixi or loader output, because the loader catches every failure and resolves
null.

Baseline note: `before-main` and `after` each show one `404 (Not Found)` console error. That's Chrome's
automatic `/favicon.ico` request (`curl` confirms 404). It exists on `main` too: the app has no favicon.

## AFTER (`after`)

All four sheet requests returned 200 (see `after-console.txt`). No new console output compared with
`before-main`.

## Brief-literal version (`after-all-six-native`)

All 12 files returned 200. The far brazier at tile (16.5, 4.2) matches its PNG pixel for pixel
(2028/2028 opaque px), so the blit path, anchor maths and alpha are exact. But every sheet is 64 px tall
and a person is about 12 px: braziers stand about five times a person's height, and the 68 px anvil, the
barrel and the toolrack bury the building (only 509/2648 forge px survive). Hence `ENABLED_SPRITES =
["forge", "chimney"]`.

## Depth sorting

I couldn't drive a real avatar: there's no sign-in in the headless session, and avatars are positioned
by the server poller. Instead, `probe.js` put a synthetic walker in pure colours (#00ff00 / #0000ff /
#ff00ff / #00ffff) into the renderer's walker map through the dev handle, at chosen tiles. It then
rendered one frame with reduced motion and counted how many of the walker's pixels were visible.
48 = fully visible (the open-ground control at (10, 3)).

| spot (tile, depth) | after: sprites, depth 7.9 | fallback, depth 7.9 | sprites, old depth 12 | fallback, old depth 12 |
| --- | --- | --- | --- | --- |
| behind building (3, 2.4) 5.4 | 0 (hidden) | 0 | 0 | 0 |
| behind chimney (4.8, 2.0) 6.8 | 0 (hidden) | 48 (no chimney without sprites) | 0 | 48 |
| in front of chimney base (5.6, 3.0) 8.6 | **48** | 48 | 48 | 48 |
| in front of door (3, 6.8) 9.8 | **48** | 48 | **0** | **28** |

So the walker passes behind the building and in front of the chimney base correctly. With the brief's
`depth: 12`, a walker at the door is swallowed whole by the sprite (0/48). It's also partly hidden on
today's procedural art (28/48), a bug that already exists on `main`. That's why the building's depth is
7.9 (reasoning in `zones/metal/src/scenery.ts`). A single depth still mis-sorts slivers at the building's
back-right corner (around (4.6, 3.0)) and front-left corner (around (1.3, 6.2)).

## Production build smoke (`after-prod-build`)

After `pnpm build`, ran `next start -p 3100` and loaded /metal. Output, verbatim (`after-prod-build-console.txt`):

```
[console.error] Failed to load resource: the server responded with a status of 404 (Not Found)
[sprite] 200 http://localhost:3100/sprites/metal/forge.json
[sprite] 200 http://localhost:3100/sprites/metal/chimney.json
[sprite] 200 http://localhost:3100/sprites/metal/forge.png
[sprite] 200 http://localhost:3100/sprites/metal/chimney.png
```

The 404 is `/favicon.ico` (`curl` → 404), the same as on `main`. `curl -I /sprites/metal/forge.json` shows no
`Set-Cookie` header (the proxy now skips `/sprites/`), and bare `/sprites` returns 404, not a zone page.

## Scripts

`scripts/` holds the Playwright/PIL scripts that produced everything above (`capture.js`, `probe.js`,
`prod.js`, `count_probe.py`, `crop.py`, `compare.py`). They expect Playwright 1.63 with a cached Chromium
1228 and `OUT_DIR`/`OUT` set.
