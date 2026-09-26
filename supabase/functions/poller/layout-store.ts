// Supabase-backed LayoutStore for core's syncPresence: who's in the world, per-zone layout history,
// and the presence rows clients subscribe to.
import type { LayoutParticipant, LayoutStore, PresenceRow, WorldSnapshot } from "@earshot/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Display fields copied into presence. Built in one place so key order always matches for diffing. */
const display = (artistName: string, title: string, name: string | null, avatar: unknown) => ({ artistName, title, name, avatar });

export function supabaseLayoutStore(db: SupabaseClient, fallbackZoneId: string): LayoutStore {
  const check = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };

  return {
    async loadParticipants() {
      // Visible people with a current engagement. Hidden people are excluded, so the next sync
      // removes anything the hide trigger missed.
      const rows = check(
        await db
          .from("engagements")
          .select("user_id, item_key, title, artist, artist_key, profiles!inner(display_name, avatar, visible)")
          .eq("profiles.visible", true)
          .not("artist_key", "is", null),
        "loadParticipants",
      ) as unknown as {
        user_id: string;
        item_key: string;
        title: string;
        artist: string;
        artist_key: string;
        profiles: { display_name: string | null; avatar: unknown };
      }[];
      if (!rows.length) return [];
      const keys = [...new Set(rows.map((r) => r.artist_key))];
      const zones = check(await db.from("artist_zones").select("artist_key, zone_id").in("artist_key", keys), "loadArtistZones") as {
        artist_key: string;
        zone_id: string;
      }[];
      const zoneOf = new Map(zones.map((z) => [z.artist_key, z.zone_id]));
      return rows.map(
        (r): LayoutParticipant => ({
          id: r.user_id,
          zoneId: zoneOf.get(r.artist_key) ?? fallbackZoneId,
          groupKey: r.artist_key,
          itemKey: r.item_key,
          display: display(r.artist, r.title, r.profiles.display_name, r.profiles.avatar),
        }),
      );
    },

    async loadStates() {
      const rows = check(await db.from("zone_state").select("zone_id, state"), "loadStates") as { zone_id: string; state: WorldSnapshot }[];
      return new Map(rows.map((r) => [r.zone_id, r.state]));
    },

    async saveState(zoneId, snap) {
      check(await db.from("zone_state").upsert({ zone_id: zoneId, state: snap, updated_at: new Date().toISOString() }), "saveState");
    },

    async loadPresence() {
      const rows = check(
        await db.from("presence").select("user_id, zone_id, artist_key, item_key, spot, slot, spot_index, artist_name, title, display_name, avatar"),
        "loadPresence",
      ) as {
        user_id: string;
        zone_id: string;
        artist_key: string;
        item_key: string;
        spot: PresenceRow["spot"];
        slot: number | null;
        spot_index: number | null;
        artist_name: string;
        title: string;
        display_name: string | null;
        avatar: unknown;
      }[];
      return rows.map((r) => ({
        userId: r.user_id,
        zoneId: r.zone_id,
        groupKey: r.artist_key,
        itemKey: r.item_key,
        spot: r.spot,
        slot: r.slot,
        spotIndex: r.spot_index,
        display: display(r.artist_name, r.title, r.display_name, r.avatar),
      }));
    },

    async deletePresence(userIds) {
      check(await db.from("presence").delete().in("user_id", userIds), "deletePresence");
    },

    async upsertPresence(rows) {
      const now = new Date().toISOString();
      check(
        await db.from("presence").upsert(
          rows.map((r) => {
            const d = r.display as ReturnType<typeof display>;
            return {
              user_id: r.userId,
              zone_id: r.zoneId,
              artist_key: r.groupKey,
              item_key: r.itemKey,
              spot: r.spot,
              slot: r.slot,
              spot_index: r.spotIndex,
              artist_name: d.artistName,
              title: d.title,
              display_name: d.name,
              avatar: d.avatar ?? {},
              updated_at: now,
            };
          }),
        ),
        "upsertPresence",
      );
    },
  };
}
