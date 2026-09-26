# Earshot — Journey archive

> Older Session Log entries, newest first. Live story: [JOURNEY.md](JOURNEY.md).

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

### 2026-09-25 — Step 1: scaffold + deploy
**Did:** Moved the brief and prototype into `docs/`. Scaffolded the pnpm monorepo per the brief's layout. Wrote a placeholder page styled from the prototype's palette. `pnpm test` (7 passing), `pnpm typecheck`, and `pnpm build` all pass on Windows. Scanned history for secrets (clean) and widened `.gitignore` to `.env*`. Created the public GitHub repo and the Vercel project. Deployed to production and attached `earshot.world` + `www`.
**Decided:** TS 6.0 pin, TS-source workspace packages, music-free `Engagement` fields, LF line endings.
**Gotcha:** The Vercel MCP connector returns 403 on project create/update for this team. Use the CLI instead: `vercel link`, `vercel domains add`, and `vercel api <endpoint> -X PATCH` for settings like `rootDirectory`.
**State after:** Placeholder live on earshot.world.
**Next:** Check in with Jeff, then step 2 (Supabase).
