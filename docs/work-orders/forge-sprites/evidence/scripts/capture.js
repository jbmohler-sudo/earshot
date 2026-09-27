// Usage: node capture.js <label> [--block-sprites] [--url=http://localhost:3100/metal]
// Writes <outDir>/<label>.png (viewport), <label>-world.png (full world texture, art px),
// <label>-console.txt (every console message + page error + failed request).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const label = process.argv[2];
const block = process.argv.includes("--block-sprites");
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const url = urlArg ? urlArg.slice(6) : "http://localhost:3100/metal";
const outDir = process.env.OUT_DIR;
const exe = path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1228", "chrome-win64", "chrome.exe");

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const log = [];
  const sprites = [];
  page.on("console", (m) => log.push(`[console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => log.push(`[pageerror] ${e.message}`));
  page.on("requestfailed", (r) => log.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.url().includes("/sprites/")) sprites.push(`${r.status()} ${r.url()}`);
    if (r.status() >= 400) log.push(`[http ${r.status()}] ${r.url()}`);
  });
  if (block) await page.route("**/sprites/**", (route) => route.abort("blockedbyclient"));
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(() => !!window.__earshot, null, { timeout: 60000 });
  await page.waitForTimeout(2500); // sheets load + a few frames
  await page.screenshot({ path: path.join(outDir, `${label}.png`) });
  const world = await page.evaluate(async () => {
    const r = window.__earshot;
    r.frame(0);
    return r.app.renderer.extract.base64({ target: r.rt, format: "png" });
  });
  fs.writeFileSync(path.join(outDir, `${label}-world.png`), Buffer.from(world.split(",")[1], "base64"));
  const errors = log.filter((l) => l.startsWith("[console.error]") || l.startsWith("[pageerror]"));
  const report = [
    `url: ${url}`,
    `blocked /sprites/*: ${block}`,
    `sprite responses: ${sprites.length ? "\n  " + sprites.join("\n  ") : "(none)"}`,
    `console errors + page errors: ${errors.length}`,
    `--- full console / network log (${log.length} lines) ---`,
    ...log,
  ].join("\n");
  fs.writeFileSync(path.join(outDir, `${label}-console.txt`), report + "\n");
  console.log(report);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
