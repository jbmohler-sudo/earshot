// Production smoke: load /metal on `next start`, record sprite responses, console errors and page errors.
const { chromium } = require("playwright");
const path = require("path");
const exe = path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1228", "chrome-win64", "chrome.exe");
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const log = [];
  page.on("console", (m) => m.type() === "error" && log.push(`[console.error] ${m.text()}`));
  page.on("pageerror", (e) => log.push(`[pageerror] ${e.message}`));
  page.on("response", (r) => r.url().includes("/sprites/") && log.push(`[sprite] ${r.status()} ${r.url()}`));
  await page.goto("http://localhost:3100/metal", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("canvas", { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: process.env.OUT });
  console.log(log.join("\n"));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
