# Earshot — Journey

> Living project story. Protocol: [../JOURNEY_PROTOCOL.md](../JOURNEY_PROTOCOL.md).

## Current State

- **Phase:** 1 (real people in the world). Gate to Phase 2: 10 friends connected and coming back on their own.
- **Done:** Step 1. The placeholder page is live at https://earshot.world (`www` 308-redirects to the apex). Repo is https://github.com/jbmohler-sudo/earshot (public). Vercel project `earshot` is on `jeff-mohlers-projects`: root `apps/web`, Next.js, Node 24, Git-connected so pushes to `main` deploy.
- **Next:** Step 2, Supabase project + migrations + RLS. **Check in with Jeff before creating the Supabase project.**
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

## System Map

- **Web app:** `apps/web`. Placeholder landing page only.
- **Core:** `packages/core`. Plug-in contracts plus `tierOf`, with tests. World logic port is step 6.
- **Sources:** `packages/sources/src/lastfm`. Stub.
- **Zones:** `zones/*`. Id-only stubs.
- **Supabase:** `supabase/`. Empty until step 2.
- **Tests:** root `vitest.config.ts`, run with `pnpm test`.

## The Graveyard

_(nothing yet)_

## Open Questions

_(none)_

## Session Log

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
- Check in with Jeff before creating the Supabase project.
