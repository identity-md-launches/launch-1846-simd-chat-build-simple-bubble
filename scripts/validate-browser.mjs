// Optional verification runner; install Playwright and axe outside the repository.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, extname, sep, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
const playwrightPath = process.env.IMD_PLAYWRIGHT;
const { chromium, webkit } = await import(
  playwrightPath ? pathToFileURL(playwrightPath).href : "playwright"
);
const root = resolve("dist");
const output = resolve("test/scratch/interaction");
await mkdir(output, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(root, path.slice("/preview/".length) || "index.html");
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
      })
      .end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/preview/`;
const report = {
  checkedAt: new Date().toISOString(),
  browsers: [],
  tests: [],
  limitations: [],
  errors: [],
  axe: [],
  contrasts: [],
  resources: [],
};
const record = (name) => {
  report.tests.push(name);
  console.log(`PASS ${name}`);
};
function ensure(condition, message) {
  assert.ok(condition, message);
}
const vectors = {
  token: "0x52908400098527886e0f7030069857d2e4169ee7",
  walletA: "0xde709f2102306220921060314715629080e2fb77",
  walletB: "0x27b1fdb04752bbc536007a920d24acb045561c26",
  watched: "0x8617e340b3d01fa5f11f306f4090fd50e238070d",
};
const word = (n) => "0x" + BigInt(n).toString(16).padStart(64, "0");
let browser;
try {
  browser = await chromium.launch({ headless: true });
  report.browsers.push("Chromium");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const responses = [];
  page.on("response", (response) => {
    if (response.url().startsWith(origin)) {
      responses.push({
        url: new URL(response.url()).pathname,
        status: response.status(),
      });
      if (response.status() >= 400)
        errors.push(`Resource ${response.status()} ${response.url()}`);
    }
  });
  await page.route("**/*", (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort(),
  );
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  ensure(
    (await page.locator(".bubble-node").count()) === 29,
    "Expected the complete illustrative diagram.",
  );
  ensure(
    await page.evaluate(() => document.fonts.check("600 16px Inter")),
    "Inter should be locally loaded.",
  );
  record(
    "Static export loads at /preview/ with local font and all 29 illustrative nodes",
  );
  await page.getByRole("link", { name: "Explore the ecosystem" }).click();
  await page.waitForURL("**/#/explorer");
  ensure(
    (await page.locator("tbody tr").count()) === 29,
    "Explorer table should match map.",
  );
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  ensure(
    page.url().endsWith("#/explorer"),
    "Skip link must preserve the explorer route.",
  );
  ensure(
    await page.locator("#main").evaluate((el) => el === document.activeElement),
    "Skip link should move focus to main.",
  );
  record(
    "Home-to-explorer hash navigation, table and route-preserving skip link",
  );
  await page.getByRole("button", { name: "Wallets", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Holding size", exact: true })
    .selectOption("5");
  ensure(
    (await page.locator(".bubble-node").count()) === 5,
    "Minimum share filter should leave 5 wallets.",
  );
  ensure(
    (await page.locator("tbody tr").count()) === 5,
    "Table should use same filter.",
  );
  await page.getByRole("searchbox").fill("Wallet 10");
  ensure(
    (await page.locator(".bubble-node").count()) === 1,
    "Search must intersect share filter.",
  );
  await page.getByRole("searchbox").fill("no matching wallet");
  ensure(
    await page.getByRole("heading", { name: "No matching nodes" }).isVisible(),
    "Empty state expected.",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .first()
    .click();
  ensure(
    (await page.locator(".bubble-node").count()) === 29,
    "Reset should restore complete view.",
  );
  record(
    "Combined wallet, holding-size, search filters, empty state and reset",
  );
  await page.getByRole("button", { name: "Filter cluster 2" }).click();
  ensure(
    (await page.locator(".bubble-node").count()) === 7,
    "Second cluster should have 6 wallets + one token.",
  );
  await page.getByRole("button", { name: "Filter cluster 2" }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  ensure(
    (await page.getByLabel("Map zoom").innerText()) === "120%",
    "Zoom in should change view.",
  );
  await page.getByRole("button", { name: "Reset map view" }).click();
  ensure(
    (await page.getByLabel("Map zoom").innerText()) === "100%",
    "Reset view should restore zoom.",
  );
  const svg = page.locator(".bubble-svg");
  const box = await svg.boundingBox();
  const before = await svg.locator(":scope > g").getAttribute("transform");
  await page.mouse.move(box.x + 8, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 38, box.y + 110);
  await page.mouse.up();
  ensure(
    (await svg.locator(":scope > g").getAttribute("transform")) !== before,
    "Dragging should pan the map.",
  );
  await page.getByRole("button", { name: "Reset map view" }).click();
  await svg.focus();
  await page.keyboard.press("ArrowRight");
  ensure(
    (await svg.locator(":scope > g").getAttribute("transform")) !== before,
    "Keyboard arrows should pan the map.",
  );
  await page.keyboard.press("Home");
  ensure(
    (await svg.locator(":scope > g").getAttribute("transform")) === before,
    "Home should reset keyboard pan.",
  );
  record("Cluster toggle, zoom, pointer pan and keyboard pan");
  const node = page.getByRole("button", {
    name: "Inspect Wallet 01, 18.5% of supply",
    exact: true,
  });
  await node.focus();
  await page.keyboard.press("Enter");
  ensure(
    await page
      .getByRole("heading", { name: "Wallet 01", exact: true })
      .isVisible(),
    "Keyboard should open node details.",
  );
  await page.getByRole("button", { name: "Focus connections" }).click();
  ensure(
    (await page.locator(".bubble-node").count()) === 5,
    "Focus should select the direct neighborhood.",
  );
  await page.getByLabel("Show connections", { exact: true }).first().uncheck();
  ensure(
    (await svg.locator("g > path").count()) === 0,
    "Connection visibility toggle should hide edges.",
  );
  ensure(
    (await page.locator(".bubble-node").count()) === 5,
    "Hiding edges must not alter filters.",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .first()
    .click();
  record(
    "Keyboard node selection, details, neighbor focus and connection visibility",
  );
  await page.getByRole("tab", { name: "Top holders", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  ensure(
    (await page
      .getByRole("tab", { name: "Mintable tokens", exact: true })
      .getAttribute("aria-selected")) === "true",
    "Rank tabs should support arrows.",
  );
  await page.locator(".rank-row").first().click();
  ensure(
    await page
      .getByRole("heading", { name: "Token A", exact: true })
      .isVisible(),
    "Token details should open.",
  );
  ensure(
    (await page.locator(".node-detail").innerText()).includes("Supply cap"),
    "Token capacity explanation expected.",
  );
  await page.getByRole("button", { name: "Close node details" }).click();
  record("Keyboard ranking tabs and mintable-token capacity details");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(resolve(output, "illustration.csv"));
  const csv = await readFile(resolve(output, "illustration.csv"), "utf8");
  ensure(
    csv.includes("illustration") &&
      csv.includes("Wallet 01") &&
      csv.split("\r\n").length === 30,
    "CSV should contain 29 labeled example rows.",
  );
  record(
    "CSV export includes filtered rows, exact values and illustration provenance",
  );
  const setupButton = page.locator(".header-add");
  await setupButton.click();
  await page
    .getByRole("button", { name: "Load recent data", exact: true })
    .click();
  ensure(
    (await page.locator("#setup-chainId").getAttribute("aria-invalid")) ===
      "true",
    "Missing chain ID should be explained.",
  );
  await page.waitForFunction(
    () => document.activeElement?.id === "setup-chainName",
  );
  ensure(
    await page
      .locator("#setup-chainName")
      .evaluate((el) => el === document.activeElement),
    "First invalid field should receive focus.",
  );
  await page.keyboard.press("Escape");
  ensure(
    (await page.locator("dialog").count()) === 0,
    "Escape should close setup.",
  );
  ensure(
    await setupButton.evaluate((el) => el === document.activeElement),
    "Focus should return to trigger.",
  );
  record("Setup validation, native dialog Escape and focus restoration");
  await page.locator(".help-button").click();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  ensure(
    await page
      .locator("dialog")
      .evaluate((el) => el.contains(document.activeElement)),
    "Modal focus should stay in dialog.",
  );
  await page.keyboard.press("Escape");
  record("Guide opens and dialog focus remains contained");
  let AxeBuilder;
  try {
    const axePath = playwrightPath
      ? resolve(
          dirname(playwrightPath),
          "..",
          "@axe-core/playwright/dist/index.mjs",
        )
      : "@axe-core/playwright";
    ({ default: AxeBuilder } = await import(
      axePath.startsWith("/") ? pathToFileURL(axePath).href : axePath
    ));
  } catch (error) {
    report.limitations.push(`Axe unavailable: ${error.message}`);
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    ensure(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Home must not overflow at ${width}.`,
    );
    if (width === 390) {
      const map = await page.locator(".map-canvas").boundingBox();
      const action = await page
        .getByRole("link", { name: "Explore the ecosystem" })
        .boundingBox();
      ensure(
        map.y < 550 && map.y + map.height <= 844,
        "The complete map should be visible on the first 390px screen.",
      );
      ensure(
        action.y + action.height < 844,
        "Primary action should be on the first screen.",
      );
    }
    await page.screenshot({
      path: resolve(output, `home-${width}.png`),
      fullPage: true,
    });
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: resolve(output, `home-${width}-viewport.png`),
      });
    if (AxeBuilder && [390, 1440].includes(width)) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      report.axe.push({
        page: "home",
        width,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
    }
    await page
      .getByRole("link", { name: "Data explorer", exact: true })
      .click();
    ensure(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Explorer must not overflow at ${width}.`,
    );
    await page.screenshot({
      path: resolve(output, `explorer-${width}.png`),
      fullPage: true,
    });
    if (width < 680) {
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page.getByRole("searchbox").fill("Wallet 01");
      ensure(
        (await page.locator(".bubble-node").count()) === 1,
        "Mobile filter should work.",
      );
      await page
        .getByLabel("Show connections", { exact: true })
        .last()
        .uncheck();
      await page
        .getByRole("button", { name: "Reset filters", exact: true })
        .first()
        .click();
    }
    if (AxeBuilder && width === 390) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      report.axe.push({
        page: "explorer",
        width,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
    }
    record(
      `Home and explorer at ${width}px; no horizontal overflow${width < 680 ? "; mobile filters" : ""}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.locator(".header-add").click();
  await page.screenshot({
    path: resolve(output, "setup-390.png"),
    fullPage: true,
  });
  if (AxeBuilder) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    report.axe.push({
      page: "setup",
      width: 390,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () =>
      document.getAnimations().filter((a) => a.playState === "running")
        .length === 0,
    { timeout: 1500 },
  );
  ensure(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length === 0,
    ),
    "Reduced motion should stop continuous animation.",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  report.limitations.push(
    "Physical devices and a manual screen-reader session were not tested.",
  );
  record("Reduced-motion behavior");
  report.contrasts = await page.evaluate(() => {
    const rgb = (value) =>
      value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const lum = (c) =>
      rgb(c)
        .map((x) => {
          x /= 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) =>
      (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const pairs = [
      ["Body", ".page-intro h1", "body"],
      ["Secondary", ".page-intro p", "body"],
      ["Primary button", ".page-intro .primary", ".page-intro .primary"],
    ];
    return pairs.map(([name, fg, bg]) => {
      const color = getComputedStyle(document.querySelector(fg)).color;
      let background = getComputedStyle(
        document.querySelector(bg),
      ).backgroundColor;
      if (background === "rgba(0, 0, 0, 0)")
        background = getComputedStyle(document.documentElement).backgroundColor;
      return {
        name,
        color,
        background,
        ratio: +ratio(color, background).toFixed(2),
      };
    });
  });
  // Controlled RPC responses test all application states without claiming a real ecosystem scan.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url + "#/explorer");
  let rpcMode = "wrong-network";
  let reads = [];
  await page.route("https://rpc.example.invalid/**", async (route) => {
    const request = route.request().postDataJSON();
    const { method, params, id } = request;
    reads.push(request);
    if (rpcMode === "pending") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (rpcMode === "pending") return route.abort();
    }
    if (rpcMode === "offline") return route.abort();
    let result;
    if (method === "eth_chainId")
      result = rpcMode === "wrong-network" ? "0x2105" : "0x1";
    if (method === "eth_blockNumber") result = "0x3ea";
    if (method === "eth_getBlockByNumber")
      result = { hash: "fixture-block-hash", timestamp: "0x67000000" };
    if (method === "eth_getLogs")
      result = [
        {
          topics: [
            params[0].topics[0],
            "0x" + vectors.walletA.slice(2).padStart(64, "0"),
            "0x" + vectors.walletB.slice(2).padStart(64, "0"),
          ],
          data: word(20n * 10n ** 18n),
          blockNumber: "0x3e7",
          transactionHash: "fixture-tx",
          logIndex: "0x0",
        },
      ];
    if (method === "eth_call") {
      const data = params[0].data;
      if (data === "0x18160ddd") result = word(1000n * 10n ** 18n);
      else if (data === "0x313ce567") result = word(18);
      else if (data === "0x95d89b41")
        result = "0x" + Buffer.from("Fixture").toString("hex").padEnd(64, "0");
      else if (data.startsWith("0x70a08231")) result = word(500n * 10n ** 18n);
      else {
        await route.fulfill({
          json: {
            jsonrpc: "2.0",
            id,
            error: { code: -32000, message: "No cap in this fixture" },
          },
        });
        return;
      }
    }
    await route.fulfill({ json: { jsonrpc: "2.0", id, result } });
  });
  await page.locator(".header-add").click();
  await page
    .getByLabel("Network name", { exact: true })
    .fill("Fixture network");
  await page.getByLabel("Chain ID", { exact: true }).fill("1");
  await page
    .getByLabel("Public RPC URL", { exact: false })
    .fill("https://rpc.example.invalid/");
  await page
    .getByLabel("IMD token contract", { exact: true })
    .fill(vectors.token);
  await page
    .getByLabel("Wallets to include", { exact: false })
    .fill(vectors.walletA);
  await page
    .getByLabel("Mintable token contracts", { exact: false })
    .fill(vectors.watched);
  await page.getByLabel("Recent blocks to scan").selectOption("100");
  await page
    .getByRole("button", { name: "Load recent data", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  ensure(
    (await page.getByRole("alert").innerText()).includes(
      "network does not match",
    ),
    "Wrong-network error should explain the fix.",
  );
  ensure(
    (await page.locator(".source-status").innerText()) ===
      "Illustrative preview",
    "Failure must not masquerade as live data.",
  );
  record("Wrong-network error preserves a clearly labeled illustration");
  rpcMode = "success";
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .locator(".source-status")
    .filter({ hasText: "On-chain snapshot" })
    .waitFor();
  ensure(
    (await page.locator(".bubble-node").count()) === 3,
    "Fixture scan should yield 2 wallets and 1 token.",
  );
  ensure(
    (await page.locator("tbody tr").count()) === 3,
    "Fixture table should match scan.",
  );
  ensure(
    reads
      .filter((r) => r.method === "eth_call")
      .every((r) => r.params[1] === "0x3e8"),
    "Every call should use snapshot block.",
  );
  await page.reload();
  await page
    .locator(".source-status")
    .filter({ hasText: "Saved snapshot" })
    .waitFor();
  ensure(
    (await page.locator(".bubble-node").count()) === 3,
    "Saved snapshot should survive reload.",
  );
  record(
    "Controlled RPC success, pinned-block reads and saved snapshot restoration",
  );
  rpcMode = "pending";
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel read", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Cancel read", exact: true }).click();
  ensure(
    !(await page.locator(".loading-note").count()),
    "Cancelled loading must end.",
  );
  ensure(
    (await page.locator(".source-status").innerText()).includes(
      "Saved snapshot",
    ),
    "Cancellation should retain last snapshot.",
  );
  rpcMode = "success";
  await page
    .getByRole("button", { name: "View data source", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear saved settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep settings", exact: true })
    .click();
  ensure(
    (await page.locator(".source-status").innerText()).includes(
      "Saved snapshot",
    ),
    "Cancel clear should retain data.",
  );
  await page
    .getByRole("button", { name: "View data source", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear saved settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear settings", exact: true })
    .click();
  ensure(
    (await page.locator(".source-status").innerText()) ===
      "Illustrative preview",
    "Clearing must restore illustration.",
  );
  ensure(
    await page.evaluate(
      () =>
        !localStorage.getItem("imd-atlas-config-v1") &&
        !localStorage.getItem("imd-atlas-snapshot-v1"),
    ),
    "Clear should remove both settings and snapshot.",
  );
  record(
    "Pending read cancellation and confirmed/cancelled clear-settings flows",
  );
  report.resources = [...new Map(responses.map((r) => [r.url, r])).values()];
  report.errors = errors;
  ensure(
    errors.length === 0,
    `Unexpected browser errors: ${errors.join("\n")}`,
  );
  ensure(
    report.axe.every((result) => result.violations.length === 0),
    "Accessibility violations found; inspect report.",
  );
  await context.close();
  await browser.close();
  browser = null;
  // Browser-native zoom via a temporary Chromium test extension, not CSS magnification.
  const extension = await mkdtemp(resolve(tmpdir(), "imd-zoom-extension-"));
  const profile = await mkdtemp(resolve(tmpdir(), "imd-zoom-profile-"));
  let zoomContext;
  try {
    await writeFile(
      resolve(extension, "manifest.json"),
      JSON.stringify({
        manifest_version: 3,
        name: "Local zoom validation",
        version: "1.0",
        permissions: ["tabs"],
        background: { service_worker: "worker.js" },
      }),
    );
    await writeFile(
      resolve(extension, "worker.js"),
      "chrome.runtime.onInstalled.addListener(() => {});",
    );
    zoomContext = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      viewport: { width: 1440, height: 1000 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    const worker =
      zoomContext.serviceWorkers()[0] ||
      (await zoomContext.waitForEvent("serviceworker"));
    const zoomPage = await zoomContext.newPage();
    await zoomPage.goto(url);
    await worker.evaluate(async (origin) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((t) => t.url?.startsWith(origin));
      await chrome.tabs.setZoom(tab.id, 2);
    }, origin);
    await zoomPage.waitForFunction(() => innerWidth === 720);
    ensure(
      await zoomPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Native 200% zoom should reflow without horizontal overflow.",
    );
    await zoomPage.screenshot({
      path: resolve(output, "native-zoom-200-viewport.png"),
    });
    await zoomPage
      .getByRole("link", { name: "Data explorer", exact: true })
      .click();
    ensure(
      await zoomPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Explorer at native 200% zoom should not overflow.",
    );
    await zoomPage
      .getByRole("combobox", { name: "Holding size", exact: true })
      .selectOption("5");
    ensure(
      (await zoomPage.locator(".bubble-node").count()) === 8,
      "Zoomed explorer filter must remain usable.",
    );
    record(
      "Native Chromium 200% zoom: both pages reflow and explorer filters work",
    );
  } finally {
    if (zoomContext) await zoomContext.close();
    await rm(extension, { recursive: true, force: true });
    await rm(profile, { recursive: true, force: true });
  }
  try {
    browser = await webkit.launch({ headless: true });
    const safari = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await safari.goto(url);
    await safari.getByRole("link", { name: "Explore the ecosystem" }).click();
    await safari.getByRole("button", { name: "Filters", exact: true }).click();
    await safari.getByRole("searchbox").fill("Wallet 01");
    ensure(
      (await safari.locator(".bubble-node").count()) === 1,
      "WebKit mobile filter should work.",
    );
    report.browsers.push("WebKit");
    record("WebKit mobile explorer and filter");
  } catch (error) {
    report.limitations.push(
      `WebKit not verified: ${error.message
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 5)
        .join(" ")}`,
    );
  }
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(`Report: ${resolve(output, "report.json")}`);
}
