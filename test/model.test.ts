import test from "node:test";
import assert from "node:assert/strict";
import { illustration } from "../src/illustration";
import {
  assignClusters,
  byAmount,
  compactAmount,
  exactAmount,
  filterGraph,
  isAddress,
  makeCsv,
  selector,
  share,
  validateConfig,
} from "../src/model";
import { blankConfig, defaultFilters, type MapNode } from "../src/types";

test("holding filter uses primary total supply and preserves separate token category", () => {
  const graph = filterGraph(
    illustration,
    { ...defaultFilters, minShare: 5 },
    null,
  );
  assert.equal(graph.nodes.filter((n) => n.kind === "wallet").length, 5);
  assert.equal(graph.nodes.filter((n) => n.kind === "token").length, 3);
  const ids = new Set(graph.nodes.map((n) => n.id));
  assert.ok(graph.edges.every((e) => ids.has(e.source) && ids.has(e.target)));
});
test("selected neighborhood includes both transfer and ownership neighbors", () => {
  const graph = filterGraph(
    illustration,
    { ...defaultFilters, relationship: "selected" },
    "illustration-wallet-1",
  );
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 4);
  assert.ok(graph.nodes.some((n) => n.kind === "token"));
  assert.equal(
    filterGraph(
      illustration,
      { ...defaultFilters, relationship: "selected" },
      null,
    ).nodes.length,
    0,
  );
});
test("search, kind and cluster filters intersect; zero results are valid", () => {
  assert.equal(
    filterGraph(illustration, { ...defaultFilters, query: "wAlLeT 01" }, null)
      .nodes.length,
    1,
  );
  assert.equal(
    filterGraph(
      illustration,
      { ...defaultFilters, kind: "token", cluster: 1 },
      null,
    ).nodes.length,
    1,
  );
  assert.equal(
    filterGraph(
      illustration,
      { ...defaultFilters, query: "no-such-node" },
      null,
    ).nodes.length,
    0,
  );
  assert.equal(
    filterGraph(
      illustration,
      { ...defaultFilters, relationship: "isolated" },
      null,
    ).nodes.length,
    0,
  );
});
test("hiding connections does not silently change relationship semantics", () => {
  const graph = filterGraph(
    illustration,
    { ...defaultFilters, showTransfers: false, relationship: "connected" },
    null,
  );
  assert.equal(graph.nodes.length, 29);
  assert.equal(graph.edges.length, 25);
});
test("exact values retain precision beyond JavaScript safe integers", () => {
  assert.equal(
    exactAmount("1234567890123456789012345", 18),
    "1234567.890123456789012345",
  );
  assert.equal(exactAmount("1", 18), "0.000000000000000001");
  assert.equal(exactAmount("1000000000000000000", 18), "1");
  assert.equal(exactAmount("1000", 0), "1000");
  assert.equal(exactAmount("0", 18), "0");
  assert.equal(compactAmount("1", 18), "<0.01");
  assert.equal(share("18500000", "100000000"), 18.5);
  assert.equal(share("0", "0"), 0);
});
test("ranking normalizes decimal precision without rounding", () => {
  const base = illustration.nodes[0];
  const a: MapNode = { ...base, id: "a", amount: "200", decimals: 2 };
  const b: MapNode = {
    ...base,
    id: "b",
    amount: "1000000000000000000",
    decimals: 18,
  };
  assert.equal(byAmount(a, b), -1);
});
test("clusters are connected components including isolated nodes", () => {
  const nodes = illustration.nodes
    .slice(0, 4)
    .map((n) => ({ ...n, cluster: 99 }));
  assignClusters(nodes, [illustration.edges[0]]);
  assert.equal(nodes[0].cluster, nodes[1].cluster);
  assert.notEqual(nodes[2].cluster, nodes[0].cluster);
  assert.notEqual(nodes[2].cluster, nodes[3].cluster);
});
test("ERC-20 selectors and EIP-55 published checksum vectors", () => {
  assert.equal(selector("balanceOf(address)"), "0x70a08231");
  assert.equal(selector("totalSupply()"), "0x18160ddd");
  // Canonical EIP-55 test vectors, never default ecosystem configuration.
  assert.ok(isAddress("0x52908400098527886E0F7030069857D2E4169EE7"));
  assert.ok(isAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"));
  assert.ok(!isAddress("0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"));
  assert.ok(!isAddress("0x" + "0".repeat(40)));
  assert.ok(!isAddress("not an address"));
});
test("blank owner settings cannot issue a chain read", () => {
  const errors = validateConfig(blankConfig);
  assert.ok(
    errors.chainId && errors.chainName && errors.rpcUrl && errors.tokenAddress,
  );
  assert.ok(
    validateConfig({ ...blankConfig, rpcUrl: "http://example.com" }).rpcUrl,
  );
  assert.ok(
    validateConfig({
      ...blankConfig,
      rpcUrl: "https://user:password@example.com",
    }).rpcUrl,
  );
});

test("CSV preserves unknown token capacity and escapes spreadsheet formulas", () => {
  const token = {
    ...illustration.nodes.find((n) => n.kind === "token")!,
    cap: undefined,
    label: "=DANGEROUS()",
    amount: "0",
  };
  const csv = makeCsv(illustration, [token]);
  assert.ok(csv.includes('"Unknown"'));
  assert.ok(csv.includes('"\'=DANGEROUS()"'));
  assert.ok(csv.includes('"illustration"'));
});
