// Re-run the genre mapper over every cached artist (after changing zones/registry.ts or a zone's tags).
// Tag counts aren't cached, so this re-fetches each artist's top tags at ≤4 req/s.
//   cd apps/web && node --env-file=.env.local scripts/remap-artists.ts [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { RateGate } from "../../../packages/core/src/rate-gate.ts";
import { getTopTags } from "../../../packages/sources/src/lastfm/api.ts";
import { mapTags, OVERRIDES } from "../../../zones/registry.ts";

const dryRun = process.argv.includes("--dry-run");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const apiKey = process.env.LASTFM_API_KEY!;
const gate = new RateGate(4);

const { data: rows, error } = await db.from("artist_zones").select("artist_key, artist_name, zone_id, confidence").order("artist_key");
if (error) throw error;

let moved = 0;
for (const r of rows) {
  await gate.wait();
  const tags = await getTopTags(r.artist_name ?? r.artist_key, apiKey);
  const override = OVERRIDES[r.artist_key];
  const pick = override ? { zoneId: override, confidence: 1, bestShare: 1 } : mapTags(tags);
  const changed = pick.zoneId !== r.zone_id;
  if (changed) moved++;
  console.log(
    `${changed ? "MOVE" : "keep"}  ${(r.artist_name ?? r.artist_key).padEnd(28)} ${r.zone_id.padEnd(9)} -> ${pick.zoneId.padEnd(9)} ` +
      `conf ${pick.confidence.toFixed(2)} (best share ${pick.bestShare.toFixed(2)})${override ? " [override]" : ""}`,
  );
  if (!dryRun) {
    const { error: e } = await db
      .from("artist_zones")
      .update({ zone_id: pick.zoneId, confidence: pick.confidence, tags: tags.map((t) => t.name), updated_at: new Date().toISOString() })
      .eq("artist_key", r.artist_key);
    if (e) throw e;
  }
}
console.log(`\n${rows.length} artists, ${moved} moved${dryRun ? " (dry run, nothing written)" : ""}`);
