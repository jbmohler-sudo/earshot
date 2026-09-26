// Live RLS smoke test against the linked Supabase project.
// Creates two throwaway users, checks what anon / signed-in clients can and can't do, then deletes them.
//   cd apps/web && node --env-file=.env.local scripts/rls-smoke.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("missing Supabase env vars; run vercel env pull first");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, opts);
const anon = createClient(url, anonKey, opts);

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) failures++;
};
const denied = (res) => res.error?.code === "42501";

const stamp = Date.now();
const password = `rls-${stamp}-${Math.random().toString(36).slice(2)}`;
const users = [];

async function makeUser(tag) {
  const email = `rls-smoke-${tag}-${stamp}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, anonKey, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

try {
  const a = await makeUser("a");
  const b = await makeUser("b");

  const { count } = await admin.from("profiles").select("*", { count: "exact", head: true }).in("id", [a.id, b.id]);
  check(count === 2, "signup trigger creates a profile per user");

  await admin.from("source_accounts").insert({ user_id: a.id, source: "lastfm", external_username: `rls_${stamp}`, session_key: "SECRET" });
  await admin.from("presence").insert([
    { user_id: a.id, zone_id: "metal", artist_key: "metallica", spot: "stage", slot: 0, spot_index: 0 },
    { user_id: b.id, zone_id: "metal", artist_key: "metallica", spot: "field", slot: 0, spot_index: 0 },
  ]);
  await admin.from("engagements").insert({ user_id: a.id, source: "lastfm", item_key: "metallica|one", title: "One", artist: "Metallica" });

  // anon
  let r = await anon.from("presence").select("user_id").in("user_id", [a.id, b.id]);
  check(r.data?.length === 2, "anon sees presence of visible people");
  r = await anon.from("engagements").select("title").eq("user_id", a.id);
  check(r.data?.length === 1, "anon sees engagements of visible people");
  check(denied(await anon.from("source_accounts").select("*")), "anon cannot read source_accounts");
  check(denied(await anon.from("artist_zones").select("*")), "anon cannot read artist_zones");
  check(denied(await anon.from("presence").insert({ user_id: a.id, zone_id: "x", artist_key: "x", spot: "plaza" })), "anon cannot write presence");
  check(denied(await anon.from("zone_state").select("*")), "anon cannot read zone_state");
  r = await anon.rpc("is_visible", { uid: a.id });
  check(!!r.error, "is_visible is not callable over the API");

  // signed in as a
  check(denied(await a.client.from("source_accounts").select("session_key")), "signed-in user cannot read source_accounts, even their own");
  check(denied(await a.client.from("profiles").update({ created_at: new Date().toISOString() }).eq("id", a.id)), "only display_name/avatar/visible are updatable");
  check(denied(await a.client.from("engagements").insert({ user_id: a.id, source: "lastfm", item_key: "k", title: "t", artist: "x" })), "signed-in user cannot write engagements");
  check(denied(await a.client.from("presence").delete().eq("user_id", b.id)), "signed-in user cannot delete presence");

  await a.client.from("profiles").update({ display_name: "hijack" }).eq("id", b.id);
  r = await admin.from("profiles").select("display_name").eq("id", b.id).single();
  check(r.data?.display_name === null, "cannot update another user's profile");

  r = await a.client.from("profiles").update({ display_name: "rls_a", avatar: { skin: 1 } }).eq("id", a.id).select();
  check(r.data?.[0]?.display_name === "rls_a", "can update own display_name/avatar");

  // hide toggle
  r = await a.client.from("profiles").update({ visible: false }).eq("id", a.id).select();
  check(r.data?.[0]?.visible === false, "can hide self");
  r = await admin.from("presence").select("user_id").eq("user_id", a.id);
  check(r.data?.length === 0, "hiding deletes your presence row immediately");
  r = await anon.from("profiles").select("id").eq("id", a.id);
  check(r.data?.length === 0, "anon cannot see a hidden profile");
  r = await anon.from("engagements").select("title").eq("user_id", a.id);
  check(r.data?.length === 0, "anon cannot see a hidden user's engagement");
  r = await a.client.from("profiles").select("id").eq("id", a.id);
  check(r.data?.length === 1, "hidden user still sees their own profile");
} finally {
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`cleanup failed for ${id}: ${error.message}`);
  }
  console.log(`cleanup: deleted ${users.length} test users`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
