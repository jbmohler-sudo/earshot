import { randomBytes } from "node:crypto";
import { authUrl } from "@earshot/sources/lastfm";
import { NextResponse, type NextRequest } from "next/server";
import { CONNECT_COOKIE, CONNECT_COOKIE_PATH, lastfmCredentials } from "@/lib/lastfm";
import { encodeFlow } from "@/lib/lastfm-identity";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts Last.fm web auth. Signed in: connect Last.fm to this account. Signed out: sign in with Last.fm
 * (find or create the account on the way back).
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const flow = data.user ? encodeFlow({ mode: "connect", userId: data.user.id }) : encodeFlow({ mode: "login", nonce: randomBytes(18).toString("base64url") });

  const res = NextResponse.redirect(authUrl(lastfmCredentials().apiKey, `${origin}/api/auth/lastfm/callback`));
  // Lax (not Strict) so the cookie is sent on the cross-site top-level redirect back from last.fm.
  res.cookies.set(CONNECT_COOKIE, flow, {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: CONNECT_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
