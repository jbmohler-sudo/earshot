# Earshot — Journey archive

> Older Session Log entries, newest first. Live story: [JOURNEY.md](JOURNEY.md).

### 2026-09-25 — Step 1: scaffold + deploy
**Did:** Moved the brief and prototype into `docs/`. Scaffolded the pnpm monorepo per the brief's layout. Wrote a placeholder page styled from the prototype's palette. `pnpm test` (7 passing), `pnpm typecheck`, and `pnpm build` all pass on Windows. Scanned history for secrets (clean) and widened `.gitignore` to `.env*`. Created the public GitHub repo and the Vercel project. Deployed to production and attached `earshot.world` + `www`.
**Decided:** TS 6.0 pin, TS-source workspace packages, music-free `Engagement` fields, LF line endings.
**Gotcha:** The Vercel MCP connector returns 403 on project create/update for this team. Use the CLI instead: `vercel link`, `vercel domains add`, and `vercel api <endpoint> -X PATCH` for settings like `rootDirectory`.
**State after:** Placeholder live on earshot.world.
**Next:** Check in with Jeff, then step 2 (Supabase).
