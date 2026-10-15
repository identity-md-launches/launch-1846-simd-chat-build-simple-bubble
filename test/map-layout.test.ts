import test from "node:test";
import assert from "node:assert/strict";
import { arrange } from "../src/map-layout";
import { illustration } from "../src/illustration";
import type { MapNode } from "../src/types";

function fixture(wallets: number, tokens: number, varied = false): MapNode[] {
  return Array.from({ length: wallets + tokens }, (_, i) => ({
    id: `node-${i}`, label: `Node ${i}`, kind: i < wallets ? "wallet" : "token",
    amount: varied ? (10n ** BigInt(i % 24)).toString() : "1000000",
    decimals: 0, symbol: i < wallets ? "IMD" : "AUX", cluster: varied ? i % 7 : 0,
  }));
}

for (const [width, height] of [[290, 320], [348, 320], [726, 440], [1036, 460]]) {
  for (const [name, nodes] of [
    ["illustration", illustration.nodes],
    ["80 equal wallets and one token", fixture(80, 1)],
    ["80 equal wallets and eight tokens", fixture(80, 8)],
    ["mixed balances and seven clusters at the limit", fixture(80, 8, true)],
  ] as const) {
    test(`independent hit targets and clear controls: ${name}, ${width}×${height}`, () => {
      const positions = arrange(nodes, width, height);
      assert.equal(positions.length, nodes.length);
      for (const [i, a] of positions.entries()) {
        const radius = Math.max(12, a.r);
        assert.ok(a.r >= 9 && Number.isFinite(a.r));
        assert.ok(a.x - radius >= 11.98 && a.x + radius <= width - 11.98);
        assert.ok(a.y - radius >= 39.98 && a.y + radius <= height - 59.98);
        for (const b of positions.slice(i + 1)) {
          assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= radius + Math.max(12, b.r),
            `${a.node.id} and ${b.node.id} must not share a hit target`);
        }
      }
    });
  }
}

test("layout is deterministic and leaves input untouched", () => {
  const nodes = fixture(80, 8, true);
  const before = JSON.stringify(nodes);
  assert.deepEqual(arrange(nodes, 348, 320), arrange(nodes, 348, 320));
  assert.equal(JSON.stringify(nodes), before);
  assert.deepEqual(arrange([], 348, 320), []);
});
