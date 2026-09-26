import "server-only";
import { LASTFM_SOURCE_ID, type LastfmSession } from "@earshot/sources/lastfm";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { lastfmEmail } from "./lastfm-identity";
import { createAdminClient } from "./supabase/admin";

export interface LastfmLoginResult {
  userId: string;
  created: boolean;
}

/**
 * "Sign in with Last.fm": find the Earshot account linked to this Last.fm user (or create one),
 * store the session key, and start a Supabase session on `supabase` (a cookie-bound server client).
 * Existing accounts, including ones that signed up by email, are matched on the linked username.
 */
export async function signInWithLastfm(session: LastfmSession, supabase: SupabaseClient<Database>): Promise<LastfmLoginResult> {
  const admin = createAdminClient();

  const { data: owner, error: ownerError } = await admin
    .from("source_accounts")
    .select("user_id")
    .eq("source", LASTFM_SOURCE_ID)
    .eq("external_username", session.username)
    .maybeSingle();
  if (ownerError) throw new Error(`owner lookup: ${ownerError.message}`);

  let userId: string;
  let email: string;
  let created = false;
  if (owner) {
    userId = owner.user_id;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user?.email) throw new Error(`load user: ${error?.message ?? "no email on account"}`);
    email = data.user.email;
  } else {
    email = lastfmEmail(session.username);
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { lastfm: session.username } });
    if (data.user) {
      userId = data.user.id;
      created = true;
    } else if (error && /already|exists|registered/i.test(error.message)) {
      // An earlier attempt created the user but didn't finish linking: pick it up.
      const { data: link, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (e2 || !link.user) throw new Error(`recover user: ${e2?.message}`);
      userId = link.user.id;
    } else {
      throw new Error(`create user: ${error?.message}`);
    }
    // A sensible default name; people can change it on /me.
    await admin.from("profiles").update({ display_name: session.username.slice(0, 24) }).eq("id", userId).is("display_name", null);
  }

  const { error: linkError } = await admin.from("source_accounts").upsert(
    {
      user_id: userId,
      source: LASTFM_SOURCE_ID,
      external_username: session.username,
      session_key: session.sessionKey,
      last_polled_at: null,
      last_changed_at: new Date().toISOString(), // fresh activity: the poller picks them up at the fast rate
    },
    { onConflict: "user_id,source" },
  );
  if (linkError) throw new Error(`link: ${linkError.code} ${linkError.message}`);

  // Mint a one-time token server-side (nothing is emailed) and redeem it on the cookie-bound client.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link.properties?.hashed_token) throw new Error(`generate link: ${linkErr?.message}`);
  const { error: verifyErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (verifyErr) throw new Error(`start session: ${verifyErr.message}`);

  return { userId, created };
}
