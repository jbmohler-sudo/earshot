import { getSession, LASTFM_SOURCE_ID, LastfmError, type LastfmSession } from "@earshot/sources/lastfm";
import { NextResponse, type NextRequest } from "next/server";
import { CONNECT_COOKIE, CONNECT_COOKIE_PATH, lastfmCredentials, lastfmFetch } from "@/lib/lastfm";
import { decodeFlow } from "@/lib/lastfm-identity";
import { signInWithLastfm } from "@/lib/lastfm-login";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Describe a token without logging it: length and which character classes it uses. */
function tokenShape(token: string | null): string {
  if (token === null) return "absent";
  const classes = [/[a-z]/.test(token) && "lower", /[A-Z]/.test(token) && "upper", /[0-9]/.test(token) && "digit", /[^A-Za-z0-9]/.test(token) && "other"]
    .filter(Boolean)
    .join("+");
  return `len=${token.length} chars=${classes || "none"}`;
}

/**
 * Last.fm redirects here with ?token=... after the user approves Earshot. Two modes, fixed by the flow
 * cookie set in /start: "login" (signed out: sign in with Last.fm) and "connect" (signed in: link it).
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const token = request.nextUrl.searchParams.get("token");
  const raw = request.cookies.get(CONNECT_COOKIE)?.value;
  const flow = decodeFlow(raw);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // One log line per outcome, with a distinct reason, so failures can be told apart in the Vercel logs.
  const log = (level: "info" | "warn" | "error", reason: string, extra: Record<string, unknown> = {}) =>
    console[level === "info" ? "log" : level](
      `lastfm-callback ${reason} ${JSON.stringify({ mode: flow?.mode ?? "none", token: tokenShape(token), cookie: raw ? "present" : "absent", ...extra })}`,
    );
  const finish = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    res.cookies.set(CONNECT_COOKIE, "", { path: CONNECT_COOKIE_PATH, maxAge: 0 });
    return res;
  };
  // Where failures go: /me for anyone signed in (connecting), the sign-in page otherwise.
  const fail = (status: string) => finish(flow?.mode === "connect" || data.user ? `/me?lastfm=${status}` : `/login?lastfm=${status}`);

  if (!token || token.length > 256 || /[\s\x00-\x1f]/.test(token)) {
    log("warn", "bad-token");
    return fail("denied");
  }
  // The flow must have started in this browser in the last 10 minutes.
  if (!raw) {
    log("warn", "cookie-missing");
    return fail("expired");
  }
  if (!flow) {
    log("warn", "cookie-malformed");
    return fail("expired");
  }

  if (flow.mode === "connect" && flow.userId !== data.user?.id) {
    log("warn", data.user ? "cookie-mismatch" : "no-session");
    return fail("expired");
  }

  let session: LastfmSession;
  try {
    session = await getSession(token, lastfmCredentials(), lastfmFetch());
  } catch (e) {
    const code = e instanceof LastfmError ? e.code : null;
    log("error", "getsession-failed", { code, message: e instanceof Error ? e.message : String(e) });
    // 4 invalid token, 14 not authorized yet, 15 expired: the user should just try again.
    return fail(code !== null && [4, 14, 15].includes(code) ? "denied" : "error");
  }

  if (flow.mode === "login") {
    try {
      const r = await signInWithLastfm(session, supabase);
      log("info", r.created ? "login-created" : "login-existing");
      return finish(r.created ? "/world?welcome=1" : "/world");
    } catch (e) {
      log("error", "login-failed", { message: e instanceof Error ? e.message : String(e) });
      return fail("error");
    }
  }

  // Connect mode: link this Last.fm account to the signed-in user. One Last.fm account per Earshot account.
  const userId = flow.userId;
  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin
    .from("source_accounts")
    .select("user_id")
    .eq("source", LASTFM_SOURCE_ID)
    .eq("external_username", session.username)
    .maybeSingle();
  if (ownerError) {
    log("error", "owner-lookup-failed", { message: ownerError.message });
    return fail("error");
  }
  if (owner && owner.user_id !== userId) {
    log("warn", "username-taken");
    return fail("taken");
  }
  const { error } = await admin.from("source_accounts").upsert(
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
  if (error) {
    log(error.code === "23505" ? "warn" : "error", error.code === "23505" ? "username-taken-race" : "upsert-failed", { code: error.code, message: error.message });
    return fail(error.code === "23505" ? "taken" : "error");
  }
  log("info", "connected");
  return finish("/me?lastfm=connected");
}
