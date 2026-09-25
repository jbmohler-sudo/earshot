import { getSession, LASTFM_SOURCE_ID, LastfmError } from "@earshot/sources/lastfm";
import { NextResponse, type NextRequest } from "next/server";
import { CONNECT_COOKIE, CONNECT_COOKIE_PATH, lastfmCredentials } from "@/lib/lastfm";
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

/** Last.fm redirects here with ?token=... after the user approves Earshot. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const token = request.nextUrl.searchParams.get("token");
  const cookie = request.cookies.get(CONNECT_COOKIE)?.value;

  // One log line per outcome, with a distinct reason, so failures can be told apart in the Vercel logs.
  const log = (level: "info" | "warn" | "error", reason: string, extra: Record<string, unknown> = {}) =>
    console[level === "info" ? "log" : level](
      `lastfm-callback ${reason} ${JSON.stringify({ token: tokenShape(token), cookie: cookie ? "present" : "absent", ...extra })}`,
    );
  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/me?lastfm=${status}`, origin));
    res.cookies.set(CONNECT_COOKIE, "", { path: CONNECT_COOKIE_PATH, maxAge: 0 });
    return res;
  };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    log("warn", "no-session");
    return NextResponse.redirect(new URL("/login", origin));
  }
  const userId = data.user.id;

  if (!token || token.length > 256 || /[\s\x00-\x1f]/.test(token)) {
    log("warn", "bad-token");
    return done("denied");
  }

  // The connect flow must have started in this browser, for this user, in the last 10 minutes.
  if (!cookie) {
    log("warn", "cookie-missing");
    return done("expired");
  }
  if (cookie !== userId) {
    log("warn", "cookie-mismatch");
    return done("expired");
  }

  let session;
  try {
    session = await getSession(token, lastfmCredentials());
  } catch (e) {
    const code = e instanceof LastfmError ? e.code : null;
    log("error", "getsession-failed", { code, message: e instanceof Error ? e.message : String(e) });
    // 4 invalid token, 14 not authorized yet, 15 expired: the user should just try again.
    return done(code !== null && [4, 14, 15].includes(code) ? "denied" : "error");
  }

  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin
    .from("source_accounts")
    .select("user_id")
    .eq("source", LASTFM_SOURCE_ID)
    .eq("external_username", session.username)
    .maybeSingle();
  if (ownerError) {
    log("error", "owner-lookup-failed", { message: ownerError.message });
    return done("error");
  }
  if (owner && owner.user_id !== userId) {
    log("warn", "username-taken");
    return done("taken");
  }

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
    log(error.code === "23505" ? "warn" : "error", error.code === "23505" ? "username-taken-race" : "upsert-failed", { code: error.code, message: error.message });
    return done(error.code === "23505" ? "taken" : "error");
  }
  log("info", "connected");
  return done("connected");
}
