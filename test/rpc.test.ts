import test from "node:test";
import assert from "node:assert/strict";
import { loadSnapshot } from "../src/rpc";
import { selector } from "../src/model";
import type { EcosystemConfig } from "../src/types";
// Published EIP-55 vectors are used only as RPC test fixtures. They do not configure the app.
const [token, walletA, walletB, watched] = [
  "0x52908400098527886e0f7030069857d2e4169ee7",
  "0xde709f2102306220921060314715629080e2fb77",
  "0x27b1fdb04752bbc536007a920d24acb045561c26",
  "0x8617e340b3d01fa5f11f306f4090fd50e238070d",
];
const config: EcosystemConfig = {
  chainId: "1",
  chainName: "Fixture network",
  rpcUrl: "https://rpc.example.invalid",
  tokenAddress: token,
  mintableTokens: [watched],
  wallets: [walletA],
  blockWindow: 100,
};
const word = (n: number | bigint) =>
  "0x" + BigInt(n).toString(16).padStart(64, "0");
const topic = (address: string) => "0x" + address.slice(2).padStart(64, "0");
const text = (value: string) =>
  "0x" + Buffer.from(value).toString("hex").padEnd(64, "0");
function harness(
  options: {
    wrongChain?: boolean;
    failWallet?: boolean;
    unknownCap?: boolean;
    reorg?: boolean;
    tooWide?: boolean;
    badToken?: boolean;
  } = {},
) {
  const requests: { method: string; params: any[] }[] = [];
  let blockReads = 0;
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    const { method, params, id } = JSON.parse(String(init?.body));
    requests.push({ method, params });
    let result: unknown;
    let error = false;
    if (method === "eth_chainId")
      result = options.wrongChain ? "0x2105" : "0x1";
    if (method === "eth_blockNumber") result = "0x3ea";
    if (method === "eth_getBlockByNumber") {
      blockReads++;
      result = {
        hash:
          options.reorg && blockReads > 1
            ? "changed-block-hash"
            : "fixture-block-hash",
        timestamp: "0x67000000",
      };
    }
    if (method === "eth_getLogs") {
      const span = Number(
        BigInt(params[0].toBlock) - BigInt(params[0].fromBlock),
      );
      if (options.tooWide && span > 40) error = true;
      else
        result = [
          {
            topics: [params[0].topics[0], topic(walletA), topic(walletB)],
            data: word(20n * 10n ** 18n),
            blockNumber: "0x3e7",
            transactionHash: "fixture-transaction",
            logIndex: "0x0",
          },
        ];
    }
    if (method === "eth_call") {
      const { to, data } = params[0];
      if (options.badToken) error = true;
      else if (data === selector("decimals()")) result = word(18);
      else if (data === selector("totalSupply()"))
        result = word(1000n * 10n ** 18n);
      else if (data === selector("symbol()"))
        result = text(to === token ? "Fixture" : "Watch");
      else if (data === selector("cap()")) {
        if (options.unknownCap) error = true;
        else result = word(2000n * 10n ** 18n);
      } else if (
        data === selector("maxSupply()") ||
        data === selector("MAX_SUPPLY()")
      )
        error = true;
      else if (data.startsWith(selector("balanceOf(address)"))) {
        if (options.failWallet && data.endsWith(walletB.slice(2))) error = true;
        else result = word((to === token ? 500n : 10n) * 10n ** 18n);
      } else error = true;
    }
    return new Response(
      JSON.stringify(
        error
          ? {
              jsonrpc: "2.0",
              id,
              error: { code: -32000, message: "Fixture failure" },
            }
          : { jsonrpc: "2.0", id, result },
      ),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  return { fetcher, requests };
}
async function run(
  options: Parameters<typeof harness>[0] = {},
  nextConfig = config,
) {
  const harnessed = harness(options);
  const original = globalThis.fetch;
  globalThis.fetch = harnessed.fetcher;
  try {
    return {
      snapshot: await loadSnapshot(
        nextConfig,
        new AbortController().signal,
        () => {},
      ),
      requests: harnessed.requests,
    };
  } finally {
    globalThis.fetch = original;
  }
}
test("reads balances at a pinned block, aggregates links, and derives capacity", async () => {
  const { snapshot, requests } = await run();
  assert.equal(snapshot.block, 1000);
  assert.equal(snapshot.fromBlock, 901);
  assert.equal(snapshot.nodes.filter((n) => n.kind === "wallet").length, 2);
  assert.equal(snapshot.edges.filter((e) => e.kind === "transfer").length, 1);
  assert.equal(snapshot.edges.filter((e) => e.kind === "holding").length, 2);
  assert.equal(
    snapshot.nodes.find((n) => n.kind === "token")?.amount,
    "1000000000000000000000",
  );
  assert.ok(
    requests
      .filter((r) => r.method === "eth_call")
      .every((r) => r.params[1] === "0x3e8"),
  );
});
test("network mismatch stops before token reads", async () => {
  await assert.rejects(run({ wrongChain: true }), /network does not match/);
});
test("unsupported token fails with an actionable error", async () => {
  await assert.rejects(run({ badToken: true }), /requires ERC-20/);
});
test("failed balances are omitted and disclosed, never zero-filled", async () => {
  const { snapshot } = await run({ failWallet: true });
  assert.equal(snapshot.nodes.filter((n) => n.kind === "wallet").length, 1);
  assert.ok(snapshot.notices.some((n) => n.includes("not treated as zero")));
  assert.equal(snapshot.edges.filter((e) => e.kind === "transfer").length, 0);
});
test("missing cap stays unknown while supply and holdings remain usable", async () => {
  const { snapshot } = await run({ unknownCap: true });
  assert.equal(snapshot.nodes.find((n) => n.kind === "token")?.cap, undefined);
  assert.equal(snapshot.edges.filter((e) => e.kind === "holding").length, 2);
});
test("range splitting deduplicates transfer logs", async () => {
  const { snapshot, requests } = await run({ tooWide: true });
  assert.ok(requests.filter((r) => r.method === "eth_getLogs").length > 1);
  assert.equal(snapshot.edges.find((e) => e.kind === "transfer")?.count, 1);
});
test("reorganized snapshot is rejected instead of mixing blocks", async () => {
  await assert.rejects(run({ reorg: true }), /block changed/);
});
test("a cancelled read issues no request", async () => {
  const controller = new AbortController();
  controller.abort();
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("Unexpected fetch");
  };
  try {
    await assert.rejects(loadSnapshot(config, controller.signal, () => {}));
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test("a contract that also holds IMD has distinct wallet and token nodes", async () => {
  const { snapshot } = await run({}, { ...config, wallets: [watched] });
  assert.equal(snapshot.nodes.filter((n) => n.address === watched).length, 2);
  assert.equal(
    new Set(snapshot.nodes.map((n) => n.id)).size,
    snapshot.nodes.length,
  );
  assert.ok(
    snapshot.edges
      .filter((e) => e.kind === "holding")
      .every((e) => e.target.startsWith("token:")),
  );
});
