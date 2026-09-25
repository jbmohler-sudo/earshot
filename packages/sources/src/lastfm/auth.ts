// Last.fm web auth: https://www.last.fm/api/webauth
// 1. Send the user to authUrl(). Last.fm redirects back to `cb` with ?token=...
// 2. Exchange the token with getSession(); the returned key never expires and must stay server-side.
import { createHash } from "node:crypto";

export const LASTFM_API_ROOT = "https://ws.audioscrobbler.com/2.0/";

export interface LastfmCredentials {
  apiKey: string;
  sharedSecret: string;
}

export interface LastfmSession {
  username: string;
  sessionKey: string;
}

export function authUrl(apiKey: string, callbackUrl: string): string {
  const u = new URL("https://www.last.fm/api/auth/");
  u.searchParams.set("api_key", apiKey);
  u.searchParams.set("cb", callbackUrl);
  return u.toString();
}

/** api_sig: params sorted by name, name+value concatenated, secret appended, md5. `format`/`callback` are excluded. */
export function signParams(params: Record<string, string>, sharedSecret: string): string {
  const body = Object.keys(params)
    .filter((k) => k !== "format" && k !== "callback")
    .sort()
    .map((k) => k + params[k])
    .join("");
  return createHash("md5").update(body + sharedSecret, "utf8").digest("hex");
}

export class LastfmError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(`Last.fm error ${code}: ${message}`);
  }
}

export async function getSession(
  token: string,
  creds: LastfmCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<LastfmSession> {
  const params: Record<string, string> = { method: "auth.getSession", api_key: creds.apiKey, token };
  const body = new URLSearchParams({ ...params, api_sig: signParams(params, creds.sharedSecret), format: "json" });
  const res = await fetchImpl(LASTFM_API_ROOT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Earshot/0.1 (+https://earshot.world)" },
    body,
  });
  const json = (await res.json()) as { session?: { name: string; key: string }; error?: number; message?: string };
  if (json.error || !json.session) throw new LastfmError(json.error ?? res.status, json.message ?? "no session returned");
  return { username: json.session.name, sessionKey: json.session.key };
}
