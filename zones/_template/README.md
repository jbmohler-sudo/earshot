# Zone template

Copy this folder to `zones/<your-zone>` to make a new zone.

1. Rename the package in `package.json` to `@earshot/zone-<your-zone>`.
2. Set `id` in `src/index.ts`.
3. Implement `claims(tags)`: return a match score for an artist's Last.fm tags. The highest score wins; if every zone scores 0, the artist goes to the Outskirts.
4. Supply a `layout` (tile map size, venue slots, plaza, spawn edges) and a renderer for each venue tier: busker, tavern, amph, fest.

Code is MIT. Art and audio are CC BY 4.0.
