// Render the code-native share artwork. Requires an optional external Playwright installation.
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.IMD_PLAYWRIGHT
    ? pathToFileURL(process.env.IMD_PLAYWRIGHT).href
    : "playwright"
);
const font = (await readFile("public/fonts/InterVariable.woff2")).toString(
  "base64",
);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:Inter;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#242832;font-family:Inter,sans-serif}.brand{position:absolute;top:56px;left:64px;font-size:32px;font-weight:600;letter-spacing:-1px}.brand span{font-weight:400;color:#666d79;margin-left:8px}.copy{position:absolute;top:190px;left:64px;z-index:2}h1{font-size:66px;line-height:1.08;letter-spacing:-3px;font-weight:600;margin:0}h1 span{color:#bc421c}p{font-size:22px;line-height:1.5;max-width:440px;color:#666d79;margin-top:26px}.foot{position:absolute;left:64px;bottom:55px;font-size:16px;color:#666d79}svg{position:absolute;right:0;top:30px;width:620px;height:600px}
  </style></head><body><div class="brand">imd<span>atlas</span></div><div class="copy"><h1>Every connection,<br><span>in view.</span></h1><p>A visual explorer for IMD holders,<br>tokens, and wallet connections.</p></div><div class="foot">Explore the ecosystem →</div><svg viewBox="0 0 620 600"><defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#dce0e5"/></pattern></defs><rect x="40" y="40" width="580" height="520" fill="url(#dots)"/><g stroke="#bac1cb" fill="none"><path d="M300 310 200 180 140 140M300 310 430 170 510 140M300 310 360 440 480 490M300 310 190 440 115 350M430 170 500 260M360 440 485 380M200 180 290 100M300 310 540 320"/></g><g fill="#f9d8c9" stroke="#d56b45" stroke-width="2"><circle cx="300" cy="310" r="82"/><circle cx="190" cy="440" r="35"/><circle cx="115" cy="350" r="21"/><circle cx="227" cy="225" r="23"/><circle cx="395" cy="320" r="16"/></g><g fill="#e4ddf5" stroke="#9b86c4" stroke-width="2"><circle cx="180" cy="160" r="52"/><circle cx="290" cy="100" r="28"/><circle cx="115" cy="100" r="20"/><circle cx="120" cy="220" r="16"/></g><g fill="#dce8f6" stroke="#82a6cd" stroke-width="2"><circle cx="430" cy="170" r="54"/><circle cx="510" cy="140" r="25"/><circle cx="500" cy="260" r="32"/><circle cx="540" cy="320" r="17"/></g><g fill="#d6eade" stroke="#76ac8d" stroke-width="2"><circle cx="375" cy="460" r="54"/><circle cx="480" cy="490" r="31"/><circle cx="485" cy="380" r="26"/><circle cx="300" cy="530" r="17"/></g></svg></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await mkdir("public", { recursive: true });
  await page.screenshot({ path: resolve("public/social.png") });
  console.log("Rendered public/social.png (1200 × 630).");
} finally {
  await browser.close();
}
