# Earshot — Journey

> Living project story. Protocol: [../JOURNEY_PROTOCOL.md](../JOURNEY_PROTOCOL.md).

## Current State

- **Phase:** 1 (real people in the world). Gate to Phase 2: 10 friends connected and coming back on their own.
- **Done:** Steps 1–8, live at https://earshot.world.
  - **Step 1:** scaffold and deploy.
  - **Step 2:** Supabase schema, RLS and grants.
  - **Step 3:** magic-link sign-in, `/me` with name, avatar picker and hide toggle.
  - **Step 4:** Last.fm connect, verified by Jeff as MightyZaino.
  - **Step 5:** poller Edge Function on a 30 s pg_cron, adaptive polling, and the genre mapper (min confidence 0.35, generic tags down-weighted). Verified with Jeff's real listening.
  - **Step 6:** the prototype world ported into `packages/core` (World model), the Forge as the Metal zone plug-in, and a PixiJS renderer at `/z/metal`. `?sim=N` shows a labelled simulated crowd.
  - **Step 7:** server-side layout into `presence` + Realtime per zone; navigation (`/world`, logo links, "Enter the world", "You").
  - **Step 8:** The Lot (Indie), The Hollow (Folk) and The Outskirts as full plug-ins with placeholder art. Stage-song matching now ignores release variants.
  - **Email:** Resend SMTP (set by Jeff in the Supabase dashboard), DKIM/SPF via Resend's Vercel integration, DMARC `p=none`, branded token_hash templates. Delivery to a non-member address confirmed at the SMTP step.
  - **Gate measurement:** `select * from private.phase1_gate;` in the dashboard SQL editor. Per user: listening days and world-visit days in the last 14, plus last visit.
  - **Sign-in:** "Sign in with Last.fm" is the primary flow (one approval creates or finds the account and lands you in the world). The email fallback is a 6-digit code typed on the same page. Sessions last 400 days (HttpOnly/Secure cookie, token refreshed by the proxy on every request; measured with `scripts/session-check.mjs`).
  - **URLs:** zones live at `earshot.world/<zone id>`; `/z/<zone>` 308-redirects there.
- **In progress:** zone-travel transition (walk off, pixel world map hop, title card), with a reusable world-map component for Phase 2.
- **Next:** Step 9: invite 10 friends. Phase 2 gate: 10 connected and coming back on their own. Optionally raise Auth → Rate Limits → emails/hour from 30 in the dashboard.
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
| 2026-09-26 | `item_key` = artistKey\|`songKey(title)`. songKey drops release variants (remaster/live/deluxe/radio edit/mono/single version…), featured artists and punctuation. Display keeps the original title. | A remaster and the original must share the front rows |
| 2026-09-26 | Zone themes: Indie "The Lot" (warehouse district, rail line), Folk "The Hollow" (forest clearing, creek), Outskirts (desert roadside, highway) | Each back edge animates like the Forge's lava river; placeholder art until Aseprite sheets |
| 2026-09-26 | Every zone must pass `zones/zones.test.ts` | New zones get layout and drawing sanity checks for free |
| 2026-09-26 | Sign-in emails link to `{{ .SiteURL }}/auth/callback?token_hash=…&type=email&next=/me`, not `{{ .ConfirmationURL }}` | The PKCE default only works in the browser that asked; friends open links on their phones |
| 2026-09-26 | Labels (venue, name tags, plaza) sit on plates in a screen-space layer above the world texture | Legible over any scenery, in every zone |
| 2026-09-26 | Gate measurement = two day-level logs (`listening_days` via a trigger on engagement writes; `world_visits` via `record_world_visit()` from the zone page) + `private.phase1_gate`. No analytics tools, dates only. | Jeff: just enough to see "connected and returning" |
| 2026-09-26 | "Sign in with Last.fm" is primary: callback finds the account by linked Last.fm username (email accounts included) or creates one with a placeholder `<name>@lastfm.earshot.world`, then starts the session server-side (admin generateLink → verifyOtp token_hash). Last.fm-only accounts can't disconnect Last.fm. | Friends won't do click-link-switch-app twice; everyone needs Last.fm anyway |
| 2026-09-26 | Email fallback = 6-digit code typed on the same page (`otp_length = 6`, templates show `{{ .Token }}`) | No app switching |
| 2026-09-26 | Auth cookies: HttpOnly, Secure in prod, 400-day Max-Age renewed on each refresh. The browser Supabase client is stateless (no persist/refresh). | Safari caps JS-written cookies at 7 days; HttpOnly keeps tokens away from page scripts |
| 2026-09-26 | Zone URLs = `/<genre id>`; place names are display only. `RESERVED_PATHS` + `lib/world/zones.test.ts` keep zone ids and page folders from colliding. | Short, shareable links |
| 2026-09-26 | Supabase SMTP lives in the dashboard, not `config.toml`; `supabase config push` is safe for templates (the diff skips SMTP) but can't set `rate_limit.email_sent` | Keeps the Resend key out of the repo and the CLI |

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
- **Renderer:** `apps/web/lib/world/renderer.ts` (PixiJS, animates a `Scene`), with `scene.ts` (Scene from presence rows or a local World), `presence-feed.ts` (Realtime `zone:<id>`), `painters.ts`, `canvas-painter.ts`, `sim.ts` and `zones.ts` (the client zone registry). The page is `apps/web/app/[zone]/` (served at `/<zone id>`).
- **Server layout:** `packages/core/src/presence-sync.ts` (`syncPresence`), plus `supabase/functions/poller/layout-store.ts`. State lives in `zone_state` (server-only).
- **Sign-in:** `app/login/` (Last.fm button + email code), `app/api/auth/lastfm/{start,callback}` (login and connect modes), `lib/lastfm-login.ts`, `lib/lastfm-identity.ts` (flow cookie, placeholder email). Local end-to-end testing: `scripts/lastfm-mock.mjs` + `LASTFM_MOCK_URL` (dev only).
- **Session check:** `apps/web/scripts/session-check.mjs [base URL]`.
- **Navigation:** `/world` (redirects to your current zone, via `lib/world/where.ts`), the logo links, "Enter the world" on `/me`, and "You" in the world header.
- **Live e2e:** `apps/web/scripts/presence-e2e.mjs [holdSeconds]` runs throwaway listeners through the real poller: layout, realtime and hide. Cleans up after itself.
- **Zones:** `zones/{metal,indie,folk,outskirts}` are all full plug-ins (`claims.ts`, `layout.ts`, `scenery.ts`, `venues.ts`, `index.ts` → `createZone()`). The contract test is `zones/zones.test.ts`. Sim artists per zone are in `apps/web/lib/world/sim-artists.ts`.
- **Gate measurement:** `supabase/migrations/20260926150000_phase1_gate.sql` (`listening_days`, `world_visits`, `record_world_visit()`, `private.phase1_gate`).
- **Supabase:** project `uekzfcdfykwpvxwattsi` (BetterBody org, us-east-1). `supabase/migrations/`, pushed with `supabase db push`. `config.toml` auth section mirrors remote; only site_url and redirect URLs were changed.
- **Tests:** root `vitest.config.ts`, run with `pnpm test`.

## The Graveyard

_(nothing yet)_

## Open Questions

_(none; the realtime-channel and layout-location questions were settled in step 7, and email is decided)_

## Session Log

### 2026-09-26 — Sign-in rework, long sessions, short zone URLs
**Did:** "Sign in with Last.fm" as the primary login (login/connect modes, find-or-create by linked username, server-side session start); 6-digit email codes on the same page; `/me` and home lead with the Last.fm button. Stateless browser Supabase client plus HttpOnly/Secure 400-day cookies; measured in prod with `scripts/session-check.mjs` (expired access token refreshed silently, refresh token rotated). Tested every path locally against a Last.fm mock on desktop and phone: new user, returning user, existing email account matched by username, connect, taken, forged callback, wrong and right email codes. Zone URLs shortened to `/<zone id>` with permanent redirects and a reserved-path test. All test accounts deleted.
**Gotchas:** A Vercel deploy can report Ready for the previous build while the newest is still building; check `vercel ls` before testing prod.
**State after:** Only Jeff's account exists. Login friction is down to one approval.
**Next:** Zone-travel transition, then step 9 invites.

### 2026-09-26 — Label plates, email branding, DMARC
**Did:** Jeff verified all three genre routes. Put labels on plates above the world texture (fixes a busker label that read as hidden behind a lantern in The Hollow). Added `_dmarc` TXT `v=DMARC1; p=none;` via the Vercel CLI. Branded magic-link and confirmation templates using token_hash links, pushed with `supabase config push` (diff previewed first: templates only, SMTP untouched). Sent a test sign-in to `jbmohler+earshot-test@gmail.com`; the auth log shows it accepted with no SMTP error. Custom SMTP had already moved the email limit from 2/h to 30/h.
**Gotchas:** `rate_limit.email_sent` only syncs when SMTP is enabled in the local config, which it deliberately isn't (the key stays in the dashboard). Raise it in the dashboard if needed.
Jeff confirmed the email landed in the inbox and the link works; the alias account is deleted. Then gate measurement: `listening_days` + `world_visits` (server-only), `record_world_visit()` called from the zone page, and the `private.phase1_gate` view. The RLS smoke test covers them; verified in prod with a throwaway user, since deleted. Jeff's own row already shows today's listening and visit.
**State after:** Ready for step 9.
**Next:** Step 9 invites.

### 2026-09-26 — Song key fix + step 8 (three new zones)
**Did:** `songKey()` for stage grouping (18 variant tests), poller redeployed. Built The Lot, The Hollow and The Outskirts as full plug-ins with placeholder art; the client registry has all four zones; per-zone sim artists; a zone contract test. Checked each zone in the browser with a sim crowd and fixed two art problems (lamp light cones read as grey pyramids; drive-in screens weren't in perspective). Poller redeployed with the final layouts. 113 tests.
**Gotchas:** A Python heredoc turned the regex word boundary (backslash-b) into a literal backspace in one regex; tests caught it. Scanned all tracked files afterwards: no other control characters. Use raw strings for regex edits.
**State after:** All four zones render at `/z/<zone>`, live and `?sim=N`.
**Next:** Resend setup, then step 9 invites.

### 2026-09-26 — Step 7: server-side layout, realtime presence, navigation
**Did:** World snapshots (`toJSON`/`fromJSON`) and `syncPresence` in core; migration (presence slot, spot_index and display fields; `engagements.artist_key`; `zone_state`); poller runs the layout after every cycle; provisional layouts for the other three zones. Client: Scene model, renderer animates server layout, Realtime feed per zone, follows you on arrival. Navigation: `/world`, logo links, "Enter the world", "You". 75 tests. Live e2e passed: layout within one tick, realtime arrival on an open page, hide → presence gone in 464 ms and the avatar gone from the page within ~2 s, hidden listener stays out.
**Decided:** See the Decisions Log rows dated 2026-09-26.
**State after:** Jeff's avatar will appear in the Forge when he plays Metal. Other zones are laid out server-side but not rendered yet.
**Next:** Jeff's real-listening check, then step 8.

> Older sessions archived in [JOURNEY_ARCHIVE.md](JOURNEY_ARCHIVE.md).

## Hard Rules

- `packages/core` never mentions music.
- Never commit secrets or ask for them in chat. Env vars live in Vercel.
- `session_key` is never readable by clients.
- Run pnpm/next natively on Windows, not in a Linux sandbox.
- Migrations go through `supabase/migrations` + `supabase db push`. Every new client-readable table needs explicit GRANTs. Never grant anything on `source_accounts`.
- Run `apps/web/scripts/rls-smoke.mjs` after every migration.
- Only the poller writes `presence` (via `syncPresence`), apart from the hide trigger's delete. Don't write presence from the web app.
