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
const output = resolve("test/scratch/revision");
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
const baseline = process.argv.includes('--baseline');
const report = { checkedAt: new Date().toISOString(), phase: baseline ? 'before' : 'after', dense: [], small: [], empty: [], copy: {}, errors: [] };
const address = (n) => '0x' + n.toString(16).padStart(40, '0');
const word = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0');
const symbol = (s) => '0x' + Buffer.from(s).toString('hex').padEnd(64, '0');
const rpcUrl = 'https://review-rpc.invalid/';
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const mode of ['dense', 'small', 'empty']) {
    for (const width of mode === 'dense' ? [320, 390, 1440] : [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true });
      const page = await context.newPage();
      page.on('pageerror', e => report.errors.push(e.message));
      let requests = 0;
      await page.route(rpcUrl, async route => {
        requests++;
        const { id, method, params } = route.request().postDataJSON();
        let result;
        if (method === 'eth_chainId') result = '0x1';
        else if (method === 'eth_blockNumber') result = '0x3e8';
        else if (method === 'eth_getBlockByNumber') result = { hash: word(998), timestamp: '0x68f00000' };
        else if (method === 'eth_getLogs') result = Array.from({ length: mode === 'empty' ? 0 : mode === 'dense' ? 79 : 1 }, (_, i) => ({
          topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', word(1), word(i + 2)],
          address: address(1001), data: word(1), blockNumber: '0x3b6', transactionHash: word(i + 100), logIndex: '0x' + i.toString(16),
        }));
        else if (method === 'eth_call') {
          const watched = params[0].to === address(1002);
          const data = params[0].data;
          if (data.startsWith('0x313ce567')) result = word(0);
          else if (data.startsWith('0x18160ddd')) result = word(100000000);
          else if (data.startsWith('0x95d89b41')) result = symbol(watched ? 'AUX' : 'IMD');
          else if (data.startsWith('0x70a08231')) result = word(watched ? (data.endsWith(address(1).slice(2)) ? 100 : 0) : mode === 'dense' ? 1000000 : 1);
          else result = word(200000000);
        } else throw new Error(`Unexpected RPC method ${method}`);
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id, result }) });
      });
      await page.goto(url + '#/explorer');
      await page.locator('.header-add').click();
      for (const [key, value] of Object.entries({chainName:'Review network', chainId:'1', rpcUrl, tokenAddress:address(1001), mintableTokens:mode === 'dense' ? address(1002) : '', wallets:mode === 'empty' ? '' : address(1)})) await page.locator('#setup-' + key).fill(value);
      await page.locator('#setup-blockWindow').selectOption('100');
      await page.getByRole('button', { name:'Load recent data', exact:true }).click();
      await page.waitForFunction(() => document.querySelector('.source-status')?.textContent.includes('On-chain snapshot'));
      await page.locator('.map-canvas').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      if (mode === 'dense') {
        const metrics = await page.evaluate(() => {
          const circles = [...document.querySelectorAll('.node-body')].map(el => { const b = el.getBoundingClientRect(); return { el, x:b.x + b.width/2, y:b.y + b.height/2, r:b.width/2 }; });
          let overlaps = 0, maxPenetration = 0;
          for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
            const a = circles[i], b = circles[j];
            const p = a.r + b.r - Math.hypot(a.x - b.x, a.y - b.y);
            if (p > 0.1) { overlaps++; maxPenetration = Math.max(maxPenetration, p); }
          }
          const misses = circles.filter(a => document.elementFromPoint(a.x,a.y)?.closest('.bubble-node') !== a.el.closest('.bubble-node')).length;
          return { nodes:circles.length, overlaps, maxPenetration, misses, canvas: { width:document.querySelector('.map-canvas').clientWidth, height:document.querySelector('.map-canvas').clientHeight } };
        });
        if (!baseline) {
          assert.equal(metrics.nodes, 81);
          assert.equal(metrics.overlaps, 0);
          assert.equal(metrics.misses, 0);
          let selected = 0;
          for (let i = 0; i < 81; i++) {
            await page.locator('.map-canvas').scrollIntoViewIfNeeded();
            const body = page.locator('.node-body').nth(i);
            const box = await body.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForFunction(index => document.querySelectorAll('.bubble-node')[index]?.getAttribute('aria-pressed') === 'true', i);
            selected++;
          }
          metrics.centerClicksSelected = selected;
          await page.locator('.map-canvas').scrollIntoViewIfNeeded();
          const node = page.locator('.bubble-node').first();
          await node.focus();
          await page.keyboard.press('Enter');
          assert.equal(await node.getAttribute('aria-pressed'), 'true');
          await page.getByRole('button', { name: 'Zoom in', exact:true }).click();
          await page.getByRole('button', { name: 'Reset map view', exact:true }).click();
          assert.equal(await page.getByLabel('Map zoom').innerText(), '100%');
          // Clear selection so the evidence shows the full graph at equal opacity.
          await page.locator('.bubble-svg').click({position:{x:4,y:4}});
          await page.locator('.map-canvas').scrollIntoViewIfNeeded();
        }
        report.dense.push({ width, ...metrics });
        await page.screenshot({path:resolve(output, `${report.phase}-dense-${width}.png`)});
      } else if (mode === 'small') {
        await page.locator('.bubble-node').first().click();
        await page.getByText('View exact values', { exact:true }).click();
        const inspector = await page.locator('.node-detail').innerText();
        const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button',{name:'Export CSV',exact:true}).click()]);
        const csv = await readFile(await download.path(), 'utf8');
        if (!baseline) {
          assert.ok(inspector.includes('Share of supply\n<0.01%'));
          assert.ok(inspector.includes('Balance: 1'));
          assert.ok(csv.includes('"1","IMD","<0.01%"'));
          assert.ok((await page.locator('tbody').textContent()).includes('<0.01%'));
        }
        report.small.push({width, inspector, csv});
      } else {
        const before = await page.locator('.map-empty').innerText();
        const count = requests;
        if (!baseline) {
          assert.ok(before.includes('No wallets found'));
          assert.ok(before.includes('Edit addresses'));
          assert.equal(await page.locator('.map-empty button').count(), 0);
        }
        if (baseline) await page.locator('.map-empty button').click();
        report.empty.push({width, before, after:await page.locator('.map-empty').innerText(), additionalReads:requests - count});
        await page.reload();
        await page.waitForFunction(() => document.querySelector('.source-status')?.textContent.includes('Saved snapshot'));
        report.empty.at(-1).saved = await page.locator('.map-empty').innerText();
        if (!baseline) {
          assert.equal(report.empty.at(-1).saved, before);
          await page.getByRole('button', {name:'Edit addresses', exact:true}).first().click();
          assert.equal(await page.locator('#setup-wallets').inputValue(), '');
          assert.equal(await page.locator('#setup-blockWindow').inputValue(), '100');
          await page.locator('#setup-wallets').fill(address(1));
          await page.getByRole('button', {name:'Load recent data', exact:true}).click();
          await page.waitForFunction(() => document.querySelectorAll('.bubble-node').length === 1);
          report.empty.at(-1).recoveredNodes = await page.locator('.bubble-node').count();
        }
      }
      await context.close();
    }
  }
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(url);
  report.copy = { h1:await page.locator('h1').innerText(), guide:await page.locator('#guide-heading').innerText(), first:await page.locator('.quick-guide article h3').first().innerText() };
  if (!baseline) {
    assert.deepEqual(report.copy, {h1:'Explore the IMD ecosystem', guide:'How to use the map', first:'Filter by holding size'});
    await page.goto(url + '#/explorer');
    await page.locator('tbody tr').first().waitFor();
    assert.equal(await page.locator('#guide-heading').innerText(), 'How to use the map');
    assert.equal(await page.locator('.quick-guide article h3').first().innerText(), 'Filter by holding size');
    assert.deepEqual(report.errors, []);
  }
  console.log(JSON.stringify(report,null,2));
} finally {
  await writeFile(resolve(output, `${report.phase}.json`), JSON.stringify(report,null,2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
