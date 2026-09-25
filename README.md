# Earshot

An open source, pixel-art isometric music world at [earshot.world](https://earshot.world).

Link Last.fm and your avatar appears in the genre zone for whatever you're playing right now, at that artist's venue, next to everyone else listening. Venues grow with live listeners: busker (1), tavern (2 to 9), amphitheater (10 to 49), festival (50+).

## Layout

```
apps/web              Next.js app + PixiJS renderer
packages/core         presence rules, venue tiers, spot placement, slot assignment
packages/sources      lastfm/ (poll + auth helpers)
zones/metal           first zone plug-in (port of the Forge)
zones/indie
zones/folk
zones/outskirts       fallback zone
zones/_template       copy this to make a new zone
supabase              migrations, edge functions
docs                  Phase 1 brief, Phase 0 prototype
```

`packages/core` knows nothing about music. It deals in engagements: a person, a thing, right now.

## Develop

Requires Node 22+ and pnpm.

```bash
pnpm install
vercel env pull apps/web/.env.local
pnpm dev
pnpm test
```

## License

Code is [MIT](LICENSE). Art and audio are [CC BY 4.0](LICENSE-ART.md).
