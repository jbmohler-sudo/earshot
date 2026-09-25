import "server-only";
import type { LastfmCredentials } from "@earshot/sources/lastfm";

/** Short-lived cookie proving this browser started the connect flow (blocks forged callback links). */
export const CONNECT_COOKIE = "lf_connect";
export const CONNECT_COOKIE_PATH = "/api/auth/lastfm";

export function lastfmCredentials(): LastfmCredentials {
  const apiKey = process.env.LASTFM_API_KEY;
  const sharedSecret = process.env.LASTFM_SHARED_SECRET;
  if (!apiKey || !sharedSecret) throw new Error("LASTFM_API_KEY / LASTFM_SHARED_SECRET not set");
  return { apiKey, sharedSecret };
}
