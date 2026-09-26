// Pure helpers for Last.fm sign-in (no server-only imports, so they're unit-testable).

/**
 * Accounts created through "Sign in with Last.fm" need an email for Supabase to mint sessions.
 * They get a placeholder on a subdomain with no mailbox; nothing is ever sent there.
 */
export const LASTFM_EMAIL_DOMAIN = "lastfm.earshot.world";

export function lastfmEmail(username: string): string {
  const local = username.toLowerCase().replace(/[^a-z0-9._-]/g, "_").replace(/^[._-]+|[._-]+$/g, "") || "user";
  return `${local}@${LASTFM_EMAIL_DOMAIN}`;
}

export function isLastfmOnlyEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${LASTFM_EMAIL_DOMAIN}`);
}

/** The short-lived cookie that proves this browser started the flow, and what for. */
export type FlowCookie = { mode: "connect"; userId: string } | { mode: "login"; nonce: string };

export function encodeFlow(f: FlowCookie): string {
  return f.mode === "connect" ? `connect:${f.userId}` : `login:${f.nonce}`;
}

export function decodeFlow(v: string | undefined | null): FlowCookie | null {
  if (!v) return null;
  const [mode, rest] = [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)];
  if (mode === "connect" && /^[0-9a-f-]{36}$/i.test(rest)) return { mode: "connect", userId: rest };
  if (mode === "login" && /^[A-Za-z0-9_-]{16,64}$/.test(rest)) return { mode: "login", nonce: rest };
  return null;
}
