import "server-only";
import { LASTFM_API_ROOT, type LastfmCredentials } from "@earshot/sources/lastfm";

/** Short-lived cookie proving this browser started the Last.fm flow (blocks forged callback links). */
export const CONNECT_COOKIE = "lf_connect";
export const CONNECT_COOKIE_PATH = "/api/auth/lastfm";

export function lastfmCredentials(): LastfmCredentials {
  const apiKey = process.env.LASTFM_API_KEY;
  const sharedSecret = process.env.LASTFM_SHARED_SECRET;
  if (!apiKey || !sharedSecret) throw new Error("LASTFM_API_KEY / LASTFM_SHARED_SECRET not set");
  return { apiKey, sharedSecret };
}

/**
 * fetch for Last.fm calls. In local development only, LASTFM_MOCK_URL points the API at a mock so
 * the whole sign-in callback can be exercised without a real Last.fm login. Ignored in production.
 */
export function lastfmFetch(): typeof fetch {
  const mock = process.env.NODE_ENV === "development" ? process.env.LASTFM_MOCK_URL : undefined;
  if (!mock) return fetch;
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    return fetch(url.startsWith(LASTFM_API_ROOT) ? mock + url.slice(LASTFM_API_ROOT.length) : url, init);
  }) as typeof fetch;
}
