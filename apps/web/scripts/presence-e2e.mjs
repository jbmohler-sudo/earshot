// End-to-end check of server-side layout against the live project, without real listening:
// three throwaway users "play" a fake artist mapped to Metal; the real poller (pg_cron, every 30 s)
// must lay them out into presence; hiding one must delete its presence row at once. Cleans up after.
//   cd apps/web && node --env-file=.env.local scripts/presence-e2e.mjs [holdSeconds]
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
const hold = Number(process.argv[2] ?? 0);
const ARTIST_KEY = "e2e test band";
const stamp = Date.now();
const users = [];
let failures = 0;

const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(label, fn, timeoutMs = 75_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(2_000);
  }
  throw new Error(`timed out waiting for ${label}`);
}

try {
  await admin.from("artist_zones").upsert({ artist_key: ARTIST_KEY, artist_name: "E2E Test Band", zone_id: "metal", confidence: 1, tags: ["metal"] });
  const titles = ["Anthem", "Anthem", "Deep Cut"];
  for (const [i, title] of titles.entries()) {
    const { data, error } = await admin.auth.admin.createUser({ email: `presence-e2e-${i}-${stamp}@example.invalid`, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    await admin.from("profiles").update({ display_name: `e2e_${i}`, avatar: { skin: i, hair: i, shirt: i + 1, long: i === 1 } }).eq("id", data.user.id);
    const { error: e2 } = await admin.from("engagements").insert({
      user_id: data.user.id,
      source: "lastfm",
      item_key: `${ARTIST_KEY}|${title.toLowerCase()}`,
      title,
      artist: "E2E Test Band",
      artist_key: ARTIST_KEY,
      tags: ["metal"],
    });
    if (e2) throw e2;
  }
  console.log(`created ${users.length} test listeners; waiting for the poller to lay them out…`);

  const rows = await waitFor("presence rows", async () => {
    const { data } = await admin.from("presence").select("*").in("user_id", users);
    return data?.length === users.length ? data : null;
  });
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  const [a, b, c] = users.map((u) => byUser.get(u));
  check(rows.every((r) => r.zone_id === "metal"), "all three are in the Metal zone");
  check(a.spot === "stage" && b.spot === "stage", "the two on the shared song are in the front rows");
  check(c.spot === "field", "the one on another song is in the field");
  check(new Set(rows.map((r) => r.slot)).size === 1 && rows[0].slot !== null, "they share one venue slot");
  check(a.spot_index !== b.spot_index, "front-row spot indices are distinct");
  check(a.display_name === "e2e_0" && a.title === "Anthem" && a.artist_name === "E2E Test Band", "display fields copied into presence");

  // Anyone (anon) can see them, since they're visible.
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
  const seen = await anon.from("presence").select("user_id").in("user_id", users);
  check(seen.data?.length === 3, "anon can read their presence");

  if (hold > 0) {
    console.log(`READY: holding ${hold}s so the world can be watched`);
    await sleep(hold * 1000);
  }

  // Hide one: the trigger must delete their presence immediately, not on the next cycle.
  const t0 = Date.now();
  await admin.from("profiles").update({ visible: false }).eq("id", users[2]);
  const gone = await admin.from("presence").select("user_id").eq("user_id", users[2]);
  check(gone.data?.length === 0, `hiding deletes presence immediately (${Date.now() - t0} ms)`);
  // …and the next layout pass must not bring them back while hidden.
  await sleep(35_000);
  const still = await admin.from("presence").select("user_id").eq("user_id", users[2]);
  check(still.data?.length === 0, "the next layout pass keeps a hidden listener out");
  if (hold > 0) await sleep(10_000);
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  await admin.from("artist_zones").delete().eq("artist_key", ARTIST_KEY);
  console.log(`cleanup: deleted ${users.length} test users and the test artist`);
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
