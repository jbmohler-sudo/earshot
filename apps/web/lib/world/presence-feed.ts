// Live presence for one zone: snapshot + Supabase Realtime changes, on the channel `zone:<id>`.
// The server writes presence (layout included); this only mirrors the rows.
import { browserClient } from "@/lib/supabase/browser";
import { PRESENCE_COLUMNS, type PresenceRecord } from "./scene";

const RESYNC_MS = 60_000;

/**
 * Calls `onChange(rows, initial)` with the zone's current presence rows: once after the first snapshot
 * (initial = true), then after every change. Returns an unsubscribe function.
 */
export function subscribeZone(zoneId: string, onChange: (rows: PresenceRecord[], initial: boolean) => void): () => void {
  const db = browserClient();
  const rows = new Map<string, PresenceRecord>();
  let loaded = false;
  let closed = false;
  let pending: number | null = null;

  const emit = (initial = false) => {
    if (closed) return;
    if (initial) {
      onChange([...rows.values()], true);
      return;
    }
    // Coalesce bursts (one poll cycle can touch many rows) into one scene update.
    if (pending !== null) return;
    pending = window.setTimeout(() => {
      pending = null;
      if (!closed) onChange([...rows.values()], false);
    }, 120);
  };

  async function snapshot() {
    const { data, error } = await db.from("presence").select(PRESENCE_COLUMNS).eq("zone_id", zoneId);
    if (error || closed) return;
    rows.clear();
    for (const r of data as PresenceRecord[]) rows.set(r.user_id, r);
    const first = !loaded;
    loaded = true;
    emit(first);
  }

  const upsert = (r: PresenceRecord) => {
    if (r.zone_id === zoneId) rows.set(r.user_id, r);
    else rows.delete(r.user_id);
    if (loaded) emit();
  };

  // Subscribe first, then load the snapshot on (re)subscribe, so nothing falls between the two.
  const channel = db
    .channel(`zone:${zoneId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "presence", filter: `zone_id=eq.${zoneId}` }, (p) =>
      upsert(p.new as PresenceRecord),
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "presence", filter: `zone_id=eq.${zoneId}` }, (p) =>
      upsert(p.new as PresenceRecord),
    )
    // Deletes can't be filtered by column, so every zone hears every delete; ignore strangers.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "presence" }, (p) => {
      const id = (p.old as { user_id?: string }).user_id;
      if (id && rows.delete(id) && loaded) emit();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void snapshot();
    });

  const resync = window.setInterval(() => void snapshot(), RESYNC_MS);

  return () => {
    closed = true;
    window.clearInterval(resync);
    if (pending !== null) window.clearTimeout(pending);
    void db.removeChannel(channel);
  };
}

/**
 * Your own presence, across every zone (channel `me:<id>`): calls `onZone(row)` whenever the server
 * places you somewhere, so the page can tell when you've moved to another zone. Returns unsubscribe.
 */
export function subscribeSelf(userId: string, onZone: (row: PresenceRecord) => void): () => void {
  const db = browserClient();
  let closed = false;
  const emit = (row: PresenceRecord) => {
    if (!closed && row?.zone_id) onZone(row);
  };
  const channel = db
    .channel(`me:${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "presence", filter: `user_id=eq.${userId}` }, (p) => emit(p.new as PresenceRecord))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "presence", filter: `user_id=eq.${userId}` }, (p) => emit(p.new as PresenceRecord))
    .subscribe();
  return () => {
    closed = true;
    void db.removeChannel(channel);
  };
}

/** Where your avatar is right now (null if you're not in the world). */
export async function currentSelfZone(userId: string): Promise<string | null> {
  const { data } = await browserClient().from("presence").select("zone_id").eq("user_id", userId).maybeSingle();
  return data?.zone_id ?? null;
}
