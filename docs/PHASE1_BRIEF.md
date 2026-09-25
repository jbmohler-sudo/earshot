# Earshot: Phase 1 Brief for Mr. Code

## What Earshot is

Earshot (earshot.world) is an open source, pixel-art isometric music world. Users link Last.fm, and their avatar appears in the genre zone for whatever they're playing right now, at that artist's venue, next to everyone else listening. Venues scale with live listeners: busker (1), tavern (2 to 9), amphitheater (10 to 49), festival (50+).

- **Plan doc:** https://claude.ai/code/artifact/109e02ba-79b5-4588-96ae-9e1d8aad777f
- **Phase 0 prototype (passed):** https://claude.ai/artifact/BuQXNDAEDp9cihEYTzQ9yR
- **Prototype source:** `earshot-phase0-prototype.html` (attached). Port its world logic; don't start from scratch.

## Locked decisions

- **Name and domain:** Earshot, `earshot.world`, already registered on Jeff's Vercel team ("Jeff Mohler's projects").
- **Stack:** Next.js (App Router, TypeScript), PixiJS for rendering, Supabase (Postgres, Auth, Realtime, Edge Functions + pg_cron), Vercel hosting.
- **Art:** pixel art, Aseprite sprite sheets committed to the repo. Placeholder art is fine in Phase 1.
- **Data source:** Last.fm only. No Spotify or Apple Music integration (Spotify dev mode caps apps at about 25 users; Apple Music has no web now-playing API).
- **License:** MIT for code, CC BY 4.0 for art and audio.
- **Design rule:** people first. If a feature would work with nobody else online, it's out of scope.

## Phase 1 goal and gate

**Goal:** real people in the world.
**Gate to Phase 2:** 10 friends connected and coming back on their own.

### In scope

1. Supabase email magic-link auth.
2. "Connect Last.fm" through Last.fm web auth (verifies account ownership; typed usernames are spoofable).
3. Poller that reads each linked user's now-playing track.
4. Genre mapper that places artists into zones.
5. Three zones as plug-ins: **Metal** (port the Forge from the prototype), **Indie**, **Folk**. Anything unmatched goes to an **Outskirts** fallback.
6. Realtime presence: avatars appear, walk to venues, and move when tracks change.
7. Hide toggle: "Hide what I'm playing" removes you from the world instantly.
8. Simple avatar picker (skin, hair, shirt color). Five minutes of work, not a builder.
9. Deploy to `earshot.world`.

### Out of scope (do not build)

Chat, the world map and teleport, tune-in, traces, the TV source, the venue dive, a full avatar builder, audio previews, mobile apps.

## Environment variables

Jeff pastes these into Vercel himself (Project → Settings → Environment Variables). Pull them locally with `vercel env pull`. Never commit them and never ask for them in chat.

| Name | Notes |
| --- | --- |
| `LASTFM_API_KEY` | From Jeff's Last.fm API account |
| `LASTFM_SHARED_SECRET` | Needed to sign `auth.getSession` |
| `NEXT_PUBLIC_SUPABASE_URL` | From the Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From the Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server and Edge Functions only |

Last.fm app callback URL is already set to `https://earshot.world/api/auth/lastfm/callback`.

## Repo layout

Create the public GitHub repo `earshot` with pnpm workspaces:

```
/apps/web              Next.js app + PixiJS renderer
/packages/core         presence rules, venue tiers, spot placement, slot assignment
/packages/sources      lastfm/  (poll + auth helpers)
/zones/metal           first real zone plug-in (port of the Forge)
/zones/indie
/zones/folk
/zones/outskirts       fallback zone
/zones/_template       copy this to make a new zone
/supabase              migrations, edge functions
```

`packages/core` must not mention music. It deals in "engagements": a person, a thing, right now.

### Plug-in contracts

```ts
interface SourcePlugin {
  id: string;                        // "lastfm"
  kind: "music" | string;
  poll(accounts: SourceAccount[]): Promise<Engagement[]>;
}

interface ZonePlugin {
  id: string;                        // "metal"
  kind: "music";
  claims(tags: string[]): number;    // match score; highest wins, Outskirts if all 0
  layout: ZoneLayout;                // tile map, venue slots, plaza, spawn edges, props
  venueStyles: Record<"busker" | "tavern" | "amph" | "fest", VenueRenderer>;
  emotes: Emote[];
}
```

## Data model

```sql
profiles         (id uuid pk -> auth.users, display_name text, avatar jsonb, visible bool default true, created_at)
source_accounts  (user_id uuid, source text, external_username text, session_key text, last_polled_at timestamptz,
                  last_changed_at timestamptz, primary key (user_id, source))
engagements      (user_id uuid pk, source text, item_key text, title text, artist text, tags text[],
                  started_at timestamptz, last_seen_at timestamptz)
artist_zones     (artist_key text pk, zone_id text, confidence real, updated_at timestamptz)
presence         (user_id uuid pk, zone_id text, artist_key text, spot text check (spot in ('stage','field','plaza')),
                  updated_at timestamptz)
```

- RLS on everything. `session_key` is never readable by clients.
- Venue tier is computed from `presence` counts, not stored.
- A `traces` table is Phase 2; leave it out.

## Poller

- A Supabase Edge Function on pg_cron, running every 30 seconds.
- Call `user.getRecentTracks` with `limit=1`. A track with `@attr.nowplaying="true"` means live now.
- **Rate limit:** Last.fm asks for about 5 requests per second, which caps 30-second polling at roughly 150 active users. Build adaptive polling from day one:
  - Track changed in the last 10 minutes: poll every 30 seconds.
  - Unchanged for 10+ minutes: back off to every 2 to 5 minutes.
  - Nothing playing for 15+ minutes: mark the engagement stale, fade the avatar out, and poll every 10 minutes.
- Throttle to at most 4 requests per second. Log 429s and back off.

## Genre mapper

- On first sight of an artist, call `artist.getTopTags` and cache the result in `artist_zones`.
- Score each zone with `claims(tags)`, weighted by tag count. Start with plain lookup tables:
  - **Metal:** metal, heavy metal, thrash metal, death metal, black metal, doom metal, metalcore, nu metal, progressive metal, sludge
  - **Indie:** indie, indie rock, indie pop, lo-fi, shoegaze, dream pop, post-punk, alternative
  - **Folk:** folk, americana, singer-songwriter, bluegrass, country, acoustic, folk rock
- Add a `zones/overrides.json` file (artist → zone) that contributors can fix through PRs.
- Refresh cached tags every 30 days.

## World logic to port from the prototype

The prototype's logic is already correct. Move it into `packages/core` as pure functions with unit tests:

- **Iso math:** 16×8 tiles, `iso(x, y) = [(x - y) * 8 + OX, (x + y) * 4 + OY]`, depth-sorted by `x + y`.
- **Tiers:** busker 1, tavern 2 to 9, amph 10 to 49, fest 50+.
- **Slot assignment with hysteresis:** the top artist takes slot 0 (the festival field) only if it beats the current owner by more than 15% + 1. Unslotted artists wait in the plaza.
- **Stage song:** the most-played track among a venue's listeners, which keeps the incumbent on ties.
- **Stage vs. field:** listeners on the stage song stand in the front rows; everyone else is in the field.
- **Persistent spot indices:** a listener keeps their index while in a group, so crowds don't reshuffle every tick.
- **Spot placement:** golden-ratio spread in a half-disk facing the viewer (see `spot()` in the prototype).

## Realtime

- One Supabase Realtime channel per zone (`zone:metal`, etc.).
- The server writes `presence` rows; clients subscribe to changes for their zone and animate avatars walking between spots client-side.
- On load, the client fetches the zone's current `presence` snapshot, then applies live changes.

## Build order

1. Scaffold the monorepo, deploy an empty app to `earshot.world`.
2. Supabase project, migrations, RLS.
3. Magic-link auth, profile, avatar picker, hide toggle.
4. Last.fm web auth connect flow.
5. Poller + adaptive polling + genre mapper.
6. Port the prototype world into `packages/core` + PixiJS renderer; Metal zone as the first plug-in.
7. Realtime presence wiring.
8. Indie, Folk and Outskirts zones (placeholder art OK).
9. Invite 10 friends.

## Definition of done

- Jeff plays a Metal track in Spotify, and within about 30 seconds his avatar walks into the Metal zone at that artist's venue on `earshot.world`.
- A second account on the same song shows up next to him in the front rows.
- Turning on the hide toggle removes him from the world within one poll cycle.
- The poller stays under Last.fm's rate limit with 150 simulated accounts.
- `pnpm test` covers tiers, slot assignment, stage-song selection and the genre mapper.
