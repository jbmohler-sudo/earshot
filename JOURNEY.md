# Earshot — Journey

> Living project story. Protocol: [../JOURNEY_PROTOCOL.md](../JOURNEY_PROTOCOL.md).

## Current State

- **Phase:** 1 (real people in the world). Gate to Phase 2: 10 friends connected and coming back on their own.
- **Done:** Steps 1–4, live at https://earshot.world.
  - **Step 1:** scaffold and deploy.
  - **Step 2:** Supabase schema, RLS and grants.
  - **Step 3:** magic-link sign-in, `/me` with name, avatar picker and hide toggle.
  - **Step 4:** Last.fm web-auth connect. Everything verified except the one hop that needs a real Last.fm login.
- **Waiting on Jeff:** Jeff connects his own Last.fm account at earshot.world/me. That's the step 4 end-to-end check-in.
- **Next:** Step 5: poller (Edge Function + pg_cron) + adaptive polling + genre mapper.
- **Biggest open question:** Email delivery for friends. Supabase's built-in SMTP only sends to org team members, so custom SMTP (e.g. Resend) is needed before step 9.

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

## System Map

- **Web app:** `apps/web`. Landing page, `/login`, `/auth/callback` (PKCE code + token_hash), `/auth/signout`, `/me`, `/api/auth/lastfm/{start,callback,disconnect}`. Session refresh in `proxy.ts` (Next 16's renamed middleware).
- **Supabase clients:** `apps/web/lib/supabase/{server,admin,proxy}.ts`. Admin (service role) is server-only.
- **DB types:** `apps/web/lib/database.types.ts`, regenerated with `supabase gen types typescript --linked --schema public`.
- **RLS smoke test:** `apps/web/scripts/rls-smoke.mjs`. Run it after any migration. 18 checks against the live project; cleans up its test users.
- **Core:** `packages/core`. Plug-in contracts plus `tierOf`, with tests. World logic port is step 6.
- **Sources:** `packages/sources/src/lastfm/auth.ts`. `authUrl`, `signParams`, `getSession`, with tests. Poll is step 5.
- **Zones:** `zones/*`. Id-only stubs.
- **Supabase:** project `uekzfcdfykwpvxwattsi` (BetterBody org, us-east-1). `supabase/migrations/`, pushed with `supabase db push`. `config.toml` auth section mirrors remote; only site_url and redirect URLs were changed.
- **Tests:** root `vitest.config.ts`, run with `pnpm test`.

## The Graveyard

_(nothing yet)_

## Open Questions

- Custom SMTP provider for magic links before inviting friends (Resend?). Which sender domain?
- Realtime per-zone channels: a `postgres_changes` filter on `zone_id` won't tell the old zone when someone moves zones. Broadcast vs. filter is decided in step 7.

## Session Log

### 2026-09-25 — Steps 2–4: schema, auth, Last.fm connect
**Did:** Two migrations: five tables, RLS, explicit grants, signup and hide triggers, presence in the realtime publication, `is_visible()` in a private schema. Verified with 18 live RLS checks. Built magic-link sign-in, `/me` (name, avatar picker, hide toggle), and the Last.fm connect/disconnect routes. Pushed auth site_url and redirect URLs. Tested locally and on earshot.world with throwaway users, all deleted afterwards.
**Decided:** See the Decisions Log rows dated 2026-09-25 about grants, anon read, the hide trigger, one Last.fm per account, and the connect cookie.
**Gotchas:** (1) The Supabase MCP runs SQL read-only, and `supabase test db` needs Docker, which isn't installed. Use the Node smoke script. (2) Piping answers into CLI prompts from PowerShell prefixes a BOM, so `n` isn't read as no and `supabase config push` applied. Pipe from bash instead. (3) TS 6 no longer auto-includes `@types/*`; packages using Node APIs need `"types": ["node"]`. (4) Port 3000 is often taken locally; the umbrella `.claude/launch.json` runs Earshot on 3100.
**State after:** Everything up to the real Last.fm login is verified. A fake token gets Last.fm error 4 (invalid token), not 13 (invalid signature), so the key and secret are correct in prod.
**Next:** Jeff connects Last.fm, then step 5.

### 2026-09-25 — Step 1: scaffold + deploy
**Did:** Moved the brief and prototype into `docs/`. Scaffolded the pnpm monorepo per the brief's layout. Wrote a placeholder page styled from the prototype's palette. `pnpm test` (7 passing), `pnpm typecheck`, and `pnpm build` all pass on Windows. Scanned history for secrets (clean) and widened `.gitignore` to `.env*`. Created the public GitHub repo and the Vercel project. Deployed to production and attached `earshot.world` + `www`.
**Decided:** TS 6.0 pin, TS-source workspace packages, music-free `Engagement` fields, LF line endings.
**Gotcha:** The Vercel MCP connector returns 403 on project create/update for this team. Use the CLI instead: `vercel link`, `vercel domains add`, and `vercel api <endpoint> -X PATCH` for settings like `rootDirectory`.
**State after:** Placeholder live on earshot.world.
**Next:** Check in with Jeff, then step 2 (Supabase).

## Hard Rules

- `packages/core` never mentions music.
- Never commit secrets or ask for them in chat. Env vars live in Vercel.
- `session_key` is never readable by clients.
- Run pnpm/next natively on Windows, not in a Linux sandbox.
- Migrations go through `supabase/migrations` + `supabase db push`. Every new client-readable table needs explicit GRANTs. Never grant anything on `source_accounts`.
- Run `apps/web/scripts/rls-smoke.mjs` after every migration.
