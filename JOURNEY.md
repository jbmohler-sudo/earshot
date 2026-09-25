# Earshot — Journey

> Living project story. Protocol: [../JOURNEY_PROTOCOL.md](../JOURNEY_PROTOCOL.md).

## Current State

- **Phase:** 1 (real people in the world). Gate to Phase 2: 10 friends connected and coming back on their own.
- **Done:** Step 1 scaffold is built and committed locally: monorepo, placeholder landing page. Tests, typecheck, and `next build` pass on Windows.
- **Blocked:** No GitHub push or deploy yet. Creating the public `earshot` repo needs Jeff's approval. The Vercel CLI account (`jbmohler-5207`, team `jeff-mohlers-projects`) can't see `earshot.world`, even though its nameservers are Vercel's.
- **Next:** Publish repo → Vercel project (root dir `apps/web`) → attach `earshot.world` → step 2 (Supabase project, which needs Jeff's go-ahead).
- **Biggest open question:** Which Vercel account/team actually owns `earshot.world`?

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

- Which Vercel scope owns `earshot.world`? It may need to move to `jeff-mohlers-projects`.

## Session Log

### 2026-09-25 — Step 1 scaffold
**Did:** Moved the brief and prototype into `docs/`. Scaffolded the pnpm monorepo per the brief's layout. Wrote a placeholder page styled from the prototype's palette. `pnpm test` (7 passing), `pnpm typecheck`, and `pnpm build` all pass. Made the first local commit.
**Decided:** TS 6.0 pin, TS-source workspace packages, music-free `Engagement` fields, LF line endings.
**Deferred:** GitHub push and Vercel deploy, pending Jeff's approval to create the public repo and the domain ownership fix.
**State after:** Built and committed locally only; not live.
**Next:** Publish the repo, deploy, attach the domain, then check in before creating the Supabase project.

## Hard Rules

- `packages/core` never mentions music.
- Never commit secrets or ask for them in chat. Env vars live in Vercel.
- `session_key` is never readable by clients.
- Run pnpm/next natively on Windows, not in a Linux sandbox.
- Check in with Jeff before creating the Supabase project.
