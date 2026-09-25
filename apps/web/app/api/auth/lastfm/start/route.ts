import { authUrl } from "@earshot/sources/lastfm";
import { NextResponse, type NextRequest } from "next/server";
import { CONNECT_COOKIE, CONNECT_COOKIE_PATH, lastfmCredentials } from "@/lib/lastfm";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", origin));

  const res = NextResponse.redirect(authUrl(lastfmCredentials().apiKey, `${origin}/api/auth/lastfm/callback`));
  // Lax (not Strict) so the cookie is sent on the cross-site top-level redirect back from last.fm.
  res.cookies.set(CONNECT_COOKIE, data.user.id, {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax",
    path: CONNECT_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
