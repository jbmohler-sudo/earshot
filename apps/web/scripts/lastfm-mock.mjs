// Mock of Last.fm auth.getSession for local sign-in tests: token "mock-<username>" -> a session for <username>.
// Usage: node scripts/lastfm-mock.mjs, then put LASTFM_MOCK_URL=http://localhost:3199/ in .env.development.local
// (dev only; ignored in production), start the flow, and visit /api/auth/lastfm/callback?token=mock-<name>.
import http from "node:http";
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const p = new URLSearchParams(body || req.url.split("?")[1] || "");
    const token = p.get("token") ?? "";
    res.setHeader("content-type", "application/json");
    if (p.get("method") !== "auth.getSession" || !token.startsWith("mock-")) {
      res.end(JSON.stringify({ error: 4, message: "Unauthorized Token - This token has not been issued" }));
    } else {
      const name = token.slice(5);
      res.end(JSON.stringify({ session: { name, key: `mockkey-${name}`, subscriber: 0 } }));
    }
    console.log(`mock ${p.get("method")} token=${token}`);
  });
}).listen(3199, () => console.log("lastfm mock on :3199"));
