// Depth-sort probe: puts a synthetic walker (pure-colour look) at chosen tiles through the dev handle,
// renders one frame, and counts how many of its pixels are visible. Usage: node probe.js <label>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const label = process.argv[2];
const outDir = process.env.OUT_DIR;
const exe = path.join(process.env.LOCALAPPDATA, "ms-playwright", "chromium-1228", "chrome-win64", "chrome.exe");
const SPOTS = [
  ["behind-building", 3.0, 2.4],
  ["behind-chimney", 4.8, 2.0],
  ["front-of-chimney-base", 5.6, 3.0],
  ["front-of-door", 3.0, 6.8],
  ["open-ground-control", 10.0, 3.0],
];

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (process.argv.includes("--block-sprites")) await page.route("**/sprites/**", (r) => r.abort("blockedbyclient"));
  await page.goto("http://localhost:3100/metal", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(() => !!window.__earshot, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const results = [];
  for (const [name, x, y] of SPOTS) {
    const out = await page.evaluate(async ([x, y]) => {
      const r = window.__earshot;
      const look = { skin: "#ff00ff", hair: "#00ffff", long: false, shirt: "#00ff00", print: "#00ff00", pants: "#0000ff" };
      const view = { id: "probe", name: "probe", look, kind: "plaza", slot: null, index: null, you: false, groupKey: "", groupName: "", title: null };
      r.walkers.clear();
      r.walkers.set("probe", { view, x, y, tx: x, ty: y, moving: false, walkT: 0, phase: 0, tempo: 8, plazaWait: 1e9, leaving: false });
      r.opts.reducedMotion = true; // freeze locals/flames so frames are comparable
      r.frame(0);
      return r.app.renderer.extract.base64({ target: r.rt, format: "png" });
    }, [x, y]);
    const file = path.join(outDir, `${label}-${name}.png`);
    fs.writeFileSync(file, Buffer.from(out.split(",")[1], "base64"));
    results.push({ name, x, y, depth: +(x + y).toFixed(2), file });
  }
  fs.writeFileSync(path.join(outDir, `${label}-spots.json`), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
