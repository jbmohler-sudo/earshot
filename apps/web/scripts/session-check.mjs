// Checks how long an Earshot sign-in lasts, against a live deployment:
//  1. signs in a throwaway user through /auth/callback and records the auth cookie's attributes;
//  2. comes back "later": marks the stored session's access token expired (what days away look like)
//     and checks the proxy silently refreshes it instead of signing the user out.
//   cd apps/web && node --env-file=.env.local scripts/session-check.mjs [https://earshot.world]
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "https://earshot.world";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `session-check-${Date.now()}@example.invalid`;
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

/** Parse Set-Cookie headers into { name: { value, attrs } }. */
function parseSetCookies(res) {
  const out = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair, ...attrs] = line.split(/;\s*/);
    const i = pair.indexOf("=");
    out[pair.slice(0, i)] = { value: pair.slice(i + 1), attrs: attrs.map((a) => a.toLowerCase()) };
  }
  return out;
}
const authCookies = (jar) => Object.entries(jar).filter(([n]) => /^sb-.*-auth-token(\.\d+)?$/.test(n)).sort(([a], [b]) => a.localeCompare(b));
const cookieHeader = (jar) => Object.entries(jar).map(([n, c]) => `${n}=${c.value}`).join("; ");
const decodeSession = (jar) => {
  const raw = authCookies(jar).map(([, c]) => decodeURIComponent(c.value)).join("");
  return JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString("utf8"));
};
const encodeSession = (s) => "base64-" + Buffer.from(JSON.stringify(s), "utf8").toString("base64url");

let userId;
try {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  userId = data.user.id;

  // 1. Sign in.
  const res = await fetch(`${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=email&next=/me`, { redirect: "manual" });
  const jar = parseSetCookies(res);
  const auth = authCookies(jar);
  check(res.status >= 300 && res.status < 400 && auth.length > 0, `sign-in sets the auth cookie (${auth.map(([n]) => n).join(", ")})`);
  for (const [name, c] of auth) console.log(`      ${name}: ${c.attrs.join("; ")}`);
  const maxAge = Number(auth[0]?.[1].attrs.find((a) => a.startsWith("max-age="))?.split("=")[1] ?? NaN);
  check(maxAge >= 399 * 86400, `cookie Max-Age = ${(maxAge / 86400).toFixed(0)} days`);
  check(auth.every(([, c]) => c.attrs.includes("httponly")), "cookie is HttpOnly (page scripts can't read the tokens)");
  if (base.startsWith("https:")) check(auth.every(([, c]) => c.attrs.includes("secure")), "cookie is Secure");
  const session = decodeSession(jar);
  const accessLife = session.expires_at - Math.floor(Date.now() / 1000);
  console.log(`      access token valid for ~${Math.round(accessLife / 60)} min; refresh token present: ${!!session.refresh_token}`);

  // Signed in right after.
  let r = await fetch(`${base}/me`, { headers: { cookie: cookieHeader(jar) }, redirect: "manual" });
  check(r.status === 200, `/me is signed in straight after (${r.status})`);

  // 2. "Days later": the access token has expired; only the refresh token is still good.
  const stale = { ...session, expires_at: Math.floor(Date.now() / 1000) - 3600 };
  const staleJar = { [auth[0][0].replace(/\.\d+$/, "")]: { value: encodeSession(stale), attrs: [] } };
  r = await fetch(`${base}/me`, { headers: { cookie: cookieHeader(staleJar) }, redirect: "manual" });
  const refreshed = parseSetCookies(r);
  check(r.status === 200, `/me with an expired access token still signed in (${r.status})`);
  check(authCookies(refreshed).length > 0, "the proxy set fresh auth cookies on that request");
  if (authCookies(refreshed).length) {
    const s2 = decodeSession(refreshed);
    check(s2.access_token !== session.access_token && s2.expires_at > Math.floor(Date.now() / 1000), "new access token, valid again");
    check(s2.refresh_token !== session.refresh_token, "refresh token rotated");
    const ma2 = authCookies(refreshed)[0][1].attrs.find((a) => a.startsWith("max-age="));
    check(ma2 === `max-age=${maxAge}`, `refreshed cookie gets a fresh ${(maxAge / 86400).toFixed(0)}-day Max-Age`);
  }
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("cleanup: deleted the throwaway user");
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
