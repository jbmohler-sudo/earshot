import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isZoneId } from "./zones";

export const DEFAULT_ZONE = "metal";

/**
 * The zone a user belongs in right now: where their avatar stands, else where their current artist
 * maps, else the default. Zones without a world yet fall back to the default.
 */
export async function currentZone(userId: string | null): Promise<string> {
  if (!userId) return DEFAULT_ZONE;
  const db = createAdminClient();
  const { data: here } = await db.from("presence").select("zone_id").eq("user_id", userId).maybeSingle();
  let zone = here?.zone_id;
  if (!zone) {
    const { data: eng } = await db.from("engagements").select("artist_key").eq("user_id", userId).maybeSingle();
    if (eng?.artist_key) {
      const { data: az } = await db.from("artist_zones").select("zone_id").eq("artist_key", eng.artist_key).maybeSingle();
      zone = az?.zone_id;
    }
  }
  return zone && isZoneId(zone) ? zone : DEFAULT_ZONE;
}
