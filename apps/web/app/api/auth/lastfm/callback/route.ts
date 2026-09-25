import { getSession, LASTFM_SOURCE_ID, LastfmError } from "@earshot/sources/lastfm";
import { NextResponse, type NextRequest } from "next/server";
import { CONNECT_COOKIE, CONNECT_COOKIE_PATH, lastfmCredentials } from "@/lib/lastfm";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Last.fm redirects here with ?token=... after the user approves Earshot. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/me?lastfm=${status}`, origin));
    res.cookies.set(CONNECT_COOKIE, "", { path: CONNECT_COOKIE_PATH, maxAge: 0 });
    return res;
  };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", origin));
  const userId = data.user.id;

  // The connect flow must have started in this browser, for this user, in the last 10 minutes.
  if (request.cookies.get(CONNECT_COOKIE)?.value !== userId) return done("expired");

  const token = request.nextUrl.searchParams.get("token");
  if (!token || !/^[A-Za-z0-9]{8,64}$/.test(token)) return done("denied");

  let session;
  try {
    session = await getSession(token, lastfmCredentials());
  } catch (e) {
    console.error("lastfm getSession failed", e instanceof Error ? e.message : e);
    // 4 invalid token, 14 not authorized yet, 15 expired: the user should just try again.
    return done(e instanceof LastfmError && [4, 14, 15].includes(e.code) ? "denied" : "error");
  }

  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("source_accounts")
    .select("user_id")
    .eq("source", LASTFM_SOURCE_ID)
    .eq("external_username", session.username)
    .maybeSingle();
  if (owner && owner.user_id !== userId) return done("taken");

  const now = new Date().toISOString();
  const { error } = await admin.from("source_accounts").upsert(
    {
      user_id: userId,
      source: LASTFM_SOURCE_ID,
      external_username: session.username,
      session_key: session.sessionKey,
      last_polled_at: null,
      last_changed_at: now, // counts as fresh activity so the poller picks this account up at the fast rate
    },
    { onConflict: "user_id,source" },
  );
  if (error) {
    if (error.code === "23505") return done("taken");
    console.error("source_accounts upsert failed", error.message);
    return done("error");
  }
  return done("connected");
}
