import { describe, expect, it } from "vitest";
import { decodeFlow, encodeFlow, isLastfmOnlyEmail, lastfmEmail } from "./lastfm-identity";

describe("lastfmEmail", () => {
  it("is stable, lowercase and on the no-mailbox subdomain", () => {
    expect(lastfmEmail("MightyZaino")).toBe("mightyzaino@lastfm.earshot.world");
    expect(lastfmEmail("mightyzaino")).toBe(lastfmEmail("MIGHTYZAINO"));
    expect(lastfmEmail("riff_witch-42")).toBe("riff_witch-42@lastfm.earshot.world");
  });
  it("never produces an invalid local part", () => {
    expect(lastfmEmail("..weird..")).toBe("weird@lastfm.earshot.world");
    expect(lastfmEmail("a b/c")).toBe("a_b_c@lastfm.earshot.world");
    expect(lastfmEmail("___")).toBe("user@lastfm.earshot.world");
  });
  it("recognizes placeholder addresses", () => {
    expect(isLastfmOnlyEmail("x@lastfm.earshot.world")).toBe(true);
    expect(isLastfmOnlyEmail("X@LASTFM.EARSHOT.WORLD")).toBe(true);
    expect(isLastfmOnlyEmail("jeff@gmail.com")).toBe(false);
    expect(isLastfmOnlyEmail(null)).toBe(false);
  });
});

describe("flow cookie", () => {
  const uid = "868dfab2-2828-4c1b-8129-f51e1a082b73";
  it("round-trips both modes", () => {
    expect(decodeFlow(encodeFlow({ mode: "connect", userId: uid }))).toEqual({ mode: "connect", userId: uid });
    expect(decodeFlow(encodeFlow({ mode: "login", nonce: "abcdefghijklmnop1234" }))).toEqual({ mode: "login", nonce: "abcdefghijklmnop1234" });
  });
  it("rejects anything else", () => {
    for (const bad of [undefined, "", "login:", "login:short", "connect:not-a-uuid", uid, "admin:" + uid, "login:has spaces in it!!"]) {
      expect(decodeFlow(bad)).toBeNull();
    }
  });
});
