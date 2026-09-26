import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Auth cookie options for every server-side client. Only server responses ever set these cookies
 * (the browser client is stateless), so they can be HttpOnly: page scripts can't read the tokens.
 * Max-Age stays at @supabase/ssr's 400 days, the longest browsers allow, renewed on every refresh.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
