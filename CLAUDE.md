# Earshot — Claude Instructions

Read [JOURNEY.md](JOURNEY.md) first, then [docs/PHASE1_BRIEF.md](docs/PHASE1_BRIEF.md). The Phase 0 world logic lives in
[docs/prototype.html](docs/prototype.html); port it rather than rewriting it.

Journal rules: [../JOURNEY_PROTOCOL.md](../JOURNEY_PROTOCOL.md).

## Rules

- pnpm workspaces. Run `pnpm install`, `pnpm test`, `pnpm build` natively on Windows (PowerShell), never in a Linux sandbox.
- `packages/core` must not mention music: no "artist", "track", "song" or "genre". Sources map their domain onto `Engagement`.
- Secrets live in Vercel env vars only. Pull with `vercel env pull apps/web/.env.local`. Never commit them or ask for them in chat.
- `session_key` must never be readable by clients (RLS).
- People first: if a feature would work with nobody else online, it's out of scope.
- Out of scope in Phase 1: chat, world map/teleport, tune-in, traces, TV source, venue dive, full avatar builder, audio previews, mobile apps.
- Vercel project root directory is `apps/web`.
