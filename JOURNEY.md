# Earshot — Journey

> Living project story. Protocol: [../JOURNEY_PROTOCOL.md](../JOURNEY_PROTOCOL.md).

## Current State

- **Phase:** 1 (real people in the world). Gate to Phase 2: 10 friends connected and coming back on their own.
- **Done:** Steps 1–7, live at https://earshot.world.
  - **Step 1:** scaffold and deploy.
  - **Step 2:** Supabase schema, RLS and grants.
  - **Step 3:** magic-link sign-in, `/me` with name, avatar picker and hide toggle.
  - **Step 4:** Last.fm connect, verified by Jeff as MightyZaino.
  - **Step 5:** poller Edge Function on a 30 s pg_cron, adaptive polling, and the genre mapper (min confidence 0.35, generic tags down-weighted). Verified with Jeff's real listening.
  - **Step 6:** the prototype world ported into `packages/core` (World model), the Forge as the Metal zone plug-in, and a PixiJS renderer at `/z/metal`. `?sim=N` shows a labelled simulated crowd.
  - **Step 7:** server-side layout into `presence` + Realtime per zone; navigation (`/world`, logo links, "Enter the world", "You").
- **Waiting on Jeff:** play Metallica, then Fleet Foxes, and confirm the avatar walks into Metal. Fleet Foxes → folk won't be *visible* until step 8, because only the Forge renders; `/world` falls back to `/z/metal` meanwhile.
- **Next:** Step 8: Indie, Folk and Outskirts worlds (placeholder art OK). Then Resend (`Earshot <hello@earshot.world>`; Jeff does signup + DNS) right before step 9 invites.
- **Biggest open question:** None blocking.


## The Story So Far

Phase 0 was a single-file HTML prototype of the Metal zone ("the Forge"): a simulated crowd, venue tiers, and slot assignment with hysteresis. It passed. Phase 1 turns it into a real app with Last.fm, Supabase, and live presence. See [docs/PHASE1_BRIEF.md](docs/PHASE1_BRIEF.md).

## Decisions Log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09-25 | Stack: Next.js App Router + PixiJS + Supabase + Vercel; Last.fm only | From the brief. Spotify dev mode caps at ~25 users, and Apple Music has no web now-playing API. |
| 2026-09-25 | MIT for code, CC BY 4.0 for art and audio | From the brief |
| 2026-09-25 | TypeScript pinned to ~6.0 (not 7.0) | TS 7 is the native Go port; Next.js build-time type checking relies on the JS compiler API |
| 2026-09-25 | Workspace packages ship TS source (`exports` → `src/*.ts`), and Next uses `transpilePackages` | No per-package build step |
| 2026-09-25 | Core `Engagement` uses `groupKey`/`groupName`, not `artist` | Keeps `packages/core` music-free; the Last.fm source maps artist → group |
| 2026-09-25 | Repo line endings LF via `.gitattributes` | Public repo; Jeff's global git has autocrlf on |
| 2026-09-25 | Supabase: explicit grants only. Clients may `select` profiles/engagements/presence and `update` only `display_name, avatar, visible` on their own profile. `source_accounts`/`artist_zones` have no client grants. | "Automatically expose new tables" is off; `session_key` must never reach a client |
| 2026-09-25 | The world is readable signed out (anon can see visible people's presence/engagements/profiles) | People first: a visitor should see the crowd before signing up |
| 2026-09-25 | Hide = DB trigger deletes the presence row the instant `visible` goes false | Faster than the brief's "within one poll cycle" |
| 2026-09-25 | One Last.fm account per Earshot account (`unique (source, external_username)`) | Stops two accounts claiming the same listener |
| 2026-09-25 | Last.fm callback requires an httpOnly `lf_connect` cookie holding the user id (10 min) | Blocks forged callback links from linking someone else's Last.fm to a victim |
| 2026-09-25 | Avatar = `{skin, hair, shirt, long}` palette indices; palettes from the prototype | "Five minutes, not a builder" |
| 2026-09-25 | Last.fm token check is only "present, ≤256 chars, no whitespace or control characters"; per-exit `lastfm-callback <reason>` logging is permanent | Real tokens contain non-alphanumeric characters; the strict regex rejected every real connect. The logging found it on the first retest. |
| 2026-09-25 | Poll intervals = the brief's tiers × load factor (accounts / 120), floored at 30 s | The brief's backoff targets 150 users; at 10 users it would miss the "within ~30 s" definition of done. Full backoff kicks in at 120+ accounts. |
| 2026-09-25 | Poller claims due accounts with a lease (`claim_due_accounts`, `for update skip locked`); runs stop claiming at 25 s | Overlapping or crashed runs can't double-poll or strand accounts |
| 2026-09-25 | Cron→function auth: shared `x-poller-secret` header, stored in Vault and in the function secrets, set out of band | Migration statements are stored in history, so secrets can't go in migrations. New `sb_secret` keys aren't JWTs, so the function runs with `verify_jwt = false`. |
| 2026-09-25 | Next poll is scheduled 5 s early (`SCHEDULE_SLACK_MS`) | Otherwise "+30 s" lands just after the next cron tick and the real cadence becomes 60 s |
| 2026-09-25 | Genre mapper: score = Σ tag count × zone claims, over the top 10 tags; ties go to zone order (metal, indie, folk); unclaimed → outskirts; `zones/overrides.json` wins; tags cached 30 days | From the brief, made concrete |
| 2026-09-25 | Shared packages use explicit `.ts` import extensions (`allowImportingTsExtensions`) | Lets the Deno Edge Function import `packages/*` and `zones/*/src/claims.ts` directly through an import map |
| 2026-09-25 | Genre policy lives in `zones/registry.ts` (`mapTags`): MIN_CONFIDENCE 0.35; alternative/rock/pop weighted 0.25 and unable to win a zone alone; seen live/favorites weighted 0. Core's `pickZone` only takes generic options. | Beastie Boys landed in Indie at 0.13 on "alternative" alone. Core must stay music-free. |
| 2026-09-25 | Scaled adaptive polling approved by Jeff (full backoff at 120+ accounts) | — |
| 2026-09-25 | `erasableSyntaxOnly` on (no enums or parameter properties) | Shared TS must run under Node's type stripping (scripts), Deno and vitest alike |
| 2026-09-25 | Zones draw through core's `Painter` interface, never PixiJS directly | Zones stay renderer-agnostic and Deno-importable; the web app supplies `PixiPainter` and `canvasPainter` |
| 2026-09-25 | Renderer draws the scene in art pixels into a nearest-filtered RenderTexture, then scales it by an integer factor | Reproduces the prototype's pixel look exactly; labels are screen-space Pixi Text so they stay crisp |
| 2026-09-25 | Simulated crowd only behind `?sim=N`, labelled "Simulated crowd", never mixed with real people | Needed to see festivals before 50 real users exist; people-first means no fake crowds in the real view |
| 2026-09-26 | Layout is server-side: after each poll cycle the poller runs `World` per zone (`syncPresence`) and writes presence (zone, artist, spot, slot, spot_index). Layout history persists in `zone_state`. Clients only animate. | Jeff's call: everyone sees the same world, and hysteresis survives restarts |
| 2026-09-26 | Presence rows carry display fields (name, avatar, artist, title) | One realtime table drives the view. Nothing new is exposed: the same fields are already readable for visible people. |
| 2026-09-26 | A zone change is written as delete + insert | Realtime UPDATE filters apply to the new row, so the old zone would never hear about it; DELETEs reach every subscriber |
| 2026-09-26 | Email: Resend, sender `Earshot <hello@earshot.world>`, set up after step 8 and before step 9 | Jeff's decision; Jeff handles signup + DNS |

## System Map

- **Web app:** `apps/web`. Landing page, `/login`, `/auth/callback` (PKCE code + token_hash), `/auth/signout`, `/me`, `/api/auth/lastfm/{start,callback,disconnect}`. Session refresh in `proxy.ts` (Next 16's renamed middleware).
- **Supabase clients:** `apps/web/lib/supabase/{server,admin,proxy}.ts`. Admin (service role) is server-only.
- **DB types:** `apps/web/lib/database.types.ts`, regenerated with `supabase gen types typescript --linked --schema public`.
- **RLS smoke test:** `apps/web/scripts/rls-smoke.mjs`. Run it after any migration. 18 checks against the live project; cleans up its test users.
- **Core:** `packages/core`. Plug-in contracts, `tierOf`, `schedule`, `RateGate`, `pickZone`/`matchTags`, and the World model, all with tests (67 in the repo).
- **Sources:** `packages/sources/src/lastfm/`: `auth.ts` (web auth), `api.ts` (now-playing and top tags, 429/code-29 handling), and `poller.ts` (`runPollCycle`, pure with an injected store). Tested, including a 150-account rate simulation.
- **Poller:** `supabase/functions/poller/`, a thin Deno wrapper. Deploy with `supabase functions deploy poller --use-api --no-verify-jwt`. pg_cron job `earshot-poller` runs every 30 s; `earshot-cron-history-cleanup` runs hourly. Check health through `net._http_response` (each run returns its stats JSON). Logs: `poller <event>` lines.
- **Genre mapper:** `zones/*/src/claims.ts` (tag lists), `zones/registry.ts` (`mapTags`: threshold + tag weights), `zones/overrides.json`. Scoring is in `packages/core/src/zones.ts`. Re-map cached artists with `apps/web/scripts/remap-artists.ts [--dry-run]`.
- **World model:** `packages/core/src/world.ts` (`World.update(participants)` → venues, slots, stage item, placements), plus `iso.ts`, `painter.ts`, `person.ts` and `rng.ts`.
- **Metal zone:** `zones/metal/src/{layout,scenery,venues,claims}.ts`; `createZone()` returns the `ZonePlugin`.
- **Renderer:** `apps/web/lib/world/renderer.ts` (PixiJS, animates a `Scene`), with `scene.ts` (Scene from presence rows or a local World), `presence-feed.ts` (Realtime `zone:<id>`), `painters.ts`, `canvas-painter.ts`, `sim.ts` and `zones.ts` (the client zone registry). The page is `apps/web/app/z/[zone]/`.
- **Server layout:** `packages/core/src/presence-sync.ts` (`syncPresence`), plus `supabase/functions/poller/layout-store.ts`. State lives in `zone_state` (server-only).
- **Navigation:** `/world` (redirects to your current zone, via `lib/world/where.ts`), the logo links, "Enter the world" on `/me`, and "You" in the world header.
- **Live e2e:** `apps/web/scripts/presence-e2e.mjs [holdSeconds]` runs throwaway listeners through the real poller: layout, realtime and hide. Cleans up after itself.
- **Zones:** `zones/metal` is the full plug-in. `indie`, `folk` and `outskirts` have tag claims and a provisional pure-data `layout.ts`; their worlds come in step 8.
- **Supabase:** project `uekzfcdfykwpvxwattsi` (BetterBody org, us-east-1). `supabase/migrations/`, pushed with `supabase db push`. `config.toml` auth section mirrors remote; only site_url and redirect URLs were changed.
- **Tests:** root `vitest.config.ts`, run with `pnpm test`.

## The Graveyard

_(nothing yet)_

## Open Questions

_(none; the realtime-channel and layout-location questions were settled in step 7, and email is decided)_

## Session Log

### 2026-09-26 — Step 7: server-side layout, realtime presence, navigation
**Did:** World snapshots (`toJSON`/`fromJSON`) and `syncPresence` in core; migration (presence slot, spot_index and display fields; `engagements.artist_key`; `zone_state`); poller runs the layout after every cycle; provisional layouts for the other three zones. Client: Scene model, renderer animates server layout, Realtime feed per zone, follows you on arrival. Navigation: `/world`, logo links, "Enter the world", "You". 75 tests. Live e2e passed: layout within one tick, realtime arrival on an open page, hide → presence gone in 464 ms and the avatar gone from the page within ~2 s, hidden listener stays out.
**Decided:** See the Decisions Log rows dated 2026-09-26.
**State after:** Jeff's avatar will appear in the Forge when he plays Metal. Other zones are laid out server-side but not rendered yet.
**Next:** Jeff's real-listening check, then step 8.

### 2026-09-25 — Mapper fix + step 6 (world port, PixiJS)
**Did:** Genre mapper: added a confidence threshold and generic-tag weights, moved the policy to `registry.mapTags`, re-mapped cached artists (Beastie Boys → outskirts), and redeployed the poller. Step 6: core World model plus iso/painter/person/rng; the Forge as the Metal plug-in (seeded map identical to the prototype); the PixiJS renderer and the `/z/[zone]` view with inspector, venues and ladder; the avatar preview now uses core's `drawPerson`. Verified in the browser at desktop and phone widths, and on earshot.world.
**Decided:** See the Decisions Log rows from "Genre policy lives in" onwards.
**Gotchas:** (1) Node's type stripping rejects parameter properties, hence `erasableSyntaxOnly`. (2) The in-app browser's click coordinates are in the screenshot's own frame, not the viewport's.
**State after:** `/z/metal?sim=130` shows the full Forge. The real `/z/metal` is empty until step 7.
**Next:** Step 7, realtime presence.

### 2026-09-25 — Last.fm connect fix + step 5 (poller, genre mapper)
**Did:** Fixed the Last.fm callback: the strict token regex rejected real tokens. Added permanent per-exit logging, and Jeff connected as MightyZaino. Built the poller: core schedule, rate gate and zone scoring; the sources API and poll loop; zone claims, registry and overrides; three migrations (poll columns + lease RPC, cron job, cron-history cleanup); the Edge Function with secrets in Vault and function secrets. 45 tests pass, including 150 simulated accounts at ≤4 req/s. Found and fixed a 60 s real cadence caused by cron jitter.
**Decided:** See the Decisions Log rows dated 2026-09-25 from "Last.fm token check" onwards.
**Gotchas:** (1) The Supabase MCP is read-only; Vault writes went through a temporary service-role-only RPC, since dropped. (2) The PowerShell tool blocks `Remove-Item $var` on computed paths; use bash `rm` with a literal path. (3) `supabase functions deploy --use-api` bundles imports from outside `supabase/functions` without trouble; it uploads exactly the import graph.
**State after:** The poller runs every 30 s with 0 errors. Engagements and artist_zones fill when Jeff plays something.
**Next:** Jeff verifies real listening, then step 6.

### 2026-09-25 — Steps 2–4: schema, auth, Last.fm connect
**Did:** Two migrations: five tables, RLS, explicit grants, signup and hide triggers, presence in the realtime publication, `is_visible()` in a private schema. Verified with 18 live RLS checks. Built magic-link sign-in, `/me` (name, avatar picker, hide toggle), and the Last.fm connect/disconnect routes. Pushed auth site_url and redirect URLs. Tested locally and on earshot.world with throwaway users, all deleted afterwards.
**Decided:** See the Decisions Log rows dated 2026-09-25 about grants, anon read, the hide trigger, one Last.fm per account, and the connect cookie.
**Gotchas:** (1) The Supabase MCP runs SQL read-only, and `supabase test db` needs Docker, which isn't installed. Use the Node smoke script. (2) Piping answers into CLI prompts from PowerShell prefixes a BOM, so `n` isn't read as no and `supabase config push` applied. Pipe from bash instead. (3) TS 6 no longer auto-includes `@types/*`; packages using Node APIs need `"types": ["node"]`. (4) Port 3000 is often taken locally; the umbrella `.claude/launch.json` runs Earshot on 3100.
**State after:** Everything up to the real Last.fm login is verified. A fake token gets Last.fm error 4 (invalid token), not 13 (invalid signature), so the key and secret are correct in prod.
**Next:** Jeff connects Last.fm, then step 5.

> Older sessions archived in [JOURNEY_ARCHIVE.md](JOURNEY_ARCHIVE.md).

## Hard Rules

- `packages/core` never mentions music.
- Never commit secrets or ask for them in chat. Env vars live in Vercel.
- `session_key` is never readable by clients.
- Run pnpm/next natively on Windows, not in a Linux sandbox.
- Migrations go through `supabase/migrations` + `supabase db push`. Every new client-readable table needs explicit GRANTs. Never grant anything on `source_accounts`.
- Run `apps/web/scripts/rls-smoke.mjs` after every migration.
- Only the poller writes `presence` (via `syncPresence`), apart from the hide trigger's delete. Don't write presence from the web app.
