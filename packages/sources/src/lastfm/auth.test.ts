import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { LastfmError } from "./api.ts";
import { authUrl, getSession, signParams } from "./auth.ts";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

describe("signParams", () => {
  it("sorts params, concatenates name+value, appends the secret", () => {
    const sig = signParams({ token: "T", method: "auth.getSession", api_key: "K" }, "S");
    expect(sig).toBe(md5("api_keyKmethodauth.getSessiontokenTS"));
  });

  it("ignores format and callback", () => {
    const a = signParams({ method: "m", api_key: "k" }, "s");
    const b = signParams({ method: "m", api_key: "k", format: "json", callback: "cb" }, "s");
    expect(b).toBe(a);
  });
});

describe("authUrl", () => {
  it("encodes the callback", () => {
    const u = new URL(authUrl("KEY", "https://earshot.world/api/auth/lastfm/callback"));
    expect(u.origin + u.pathname).toBe("https://www.last.fm/api/auth/");
    expect(u.searchParams.get("api_key")).toBe("KEY");
    expect(u.searchParams.get("cb")).toBe("https://earshot.world/api/auth/lastfm/callback");
  });
});

describe("getSession", () => {
  const creds = { apiKey: "K", sharedSecret: "S" };

  it("posts a signed auth.getSession and returns the session", async () => {
    const fetchMock = vi.fn(async () => Response.json({ session: { name: "riffwitch", key: "SK", subscriber: 0 } }));
    const s = await getSession("T", creds, fetchMock as unknown as typeof fetch);
    expect(s).toEqual({ username: "riffwitch", sessionKey: "SK" });
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.get("method")).toBe("auth.getSession");
    expect(body.get("token")).toBe("T");
    expect(body.get("api_sig")).toBe(md5("api_keyKmethodauth.getSessiontokenTS"));
  });

  it("throws LastfmError on an API error", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: 4, message: "Invalid authentication token supplied" }, { status: 403 }));
    await expect(getSession("bad", creds, fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(LastfmError);
  });
});
