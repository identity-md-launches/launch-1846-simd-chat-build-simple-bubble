import type { EcosystemConfig, MapEdge, MapNode, Snapshot } from "./types";
import {
  assignClusters,
  byAmount,
  configKey,
  digest,
  selector,
  shortAddress,
} from "./model";
const TRANSFER = "0x" + digest("Transfer(address,address,uint256)");
const hex = (n: number) => "0x" + n.toString(16);
const isZero = (address: string) => /^0x0{40}$/i.test(address);
const uint = (value: unknown): bigint => {
  if (typeof value !== "string" || !/^0x[0-9a-f]{64}$/i.test(value))
    throw new Error("The contract returned an unsupported value.");
  return BigInt(value);
};
function decodeString(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]*$/i.test(value))
    throw new Error();
  const data = value.slice(2);
  let text: string;
  if (data.length === 64) text = data;
  else {
    if (data.length < 128 || BigInt("0x" + data.slice(0, 64)) !== 32n)
      throw new Error();
    const size = Number(BigInt("0x" + data.slice(64, 128)));
    if (
      !Number.isSafeInteger(size) ||
      size > 128 ||
      data.length < 128 + size * 2
    )
      throw new Error();
    text = data.slice(128, 128 + size * 2);
  }
  return new TextDecoder("utf-8", { fatal: true })
    .decode(Uint8Array.from(text.match(/.{2}/g) || [], (b) => parseInt(b, 16)))
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim()
    .slice(0, 32);
}
export async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  let cursor = 0;
  const results: R[] = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await work(items[i]);
      }
    }),
  );
  return results;
}
export async function loadSnapshot(
  config: EcosystemConfig,
  signal: AbortSignal,
  progress: (text: string) => void,
): Promise<Snapshot> {
  let requestId = 0;
  const deadline = AbortSignal.timeout(180000);
  const combined = AbortSignal.any([signal, deadline]);
  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    combined.throwIfAborted();
    const requestSignal = AbortSignal.any([
      combined,
      AbortSignal.timeout(15000),
    ]);
    let response: Response;
    try {
      response = await fetch(config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++requestId,
          method,
          params,
        }),
        signal: requestSignal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
    } catch {
      combined.throwIfAborted();
      throw new Error(
        "The RPC could not be reached. Check the URL, browser access (CORS), and your connection, then retry.",
      );
    }
    if (!response.ok)
      throw new Error(
        `The RPC returned HTTP ${response.status}. Try again or choose another public endpoint.`,
      );
    const body = await response.json();
    if (body.error || !Object.hasOwn(body, "result"))
      throw new Error(
        "The RPC could not complete this read. Try a smaller block window or another endpoint.",
      );
    return body.result;
  }
  progress("Checking the network…");
  const chain = await rpc("eth_chainId", []);
  if (
    typeof chain !== "string" ||
    !/^0x[0-9a-f]+$/i.test(chain) ||
    BigInt(chain).toString() !== config.chainId
  )
    throw new Error(
      "The RPC network does not match the chain ID. Check your network settings.",
    );
  const head = await rpc("eth_blockNumber", []);
  if (typeof head !== "string" || !/^0x[0-9a-f]+$/i.test(head))
    throw new Error("The RPC returned an invalid block number.");
  const block = Math.max(0, Number(BigInt(head)) - 2);
  if (!Number.isSafeInteger(block))
    throw new Error("The RPC returned an invalid block number.");
  const fromBlock = Math.max(0, block - config.blockWindow + 1);
  const blockTag = hex(block);
  const blockInfo = (await rpc("eth_getBlockByNumber", [blockTag, false])) as {
    hash?: string;
    timestamp?: string;
  } | null;
  if (!blockInfo?.hash || !blockInfo.timestamp)
    throw new Error("The snapshot block is not available. Try again.");
  const call = async (address: string, signature: string, argument = "") =>
    rpc("eth_call", [
      { to: address, data: selector(signature) + argument },
      blockTag,
    ]);
  async function metadata(address: string) {
    const [supplyValue, decimalValue, symbolValue] = await Promise.all([
      call(address, "totalSupply()"),
      call(address, "decimals()"),
      call(address, "symbol()").catch(() => null),
    ]);
    const supply = uint(supplyValue).toString();
    const decimals = Number(uint(decimalValue));
    if (decimals > 36)
      throw new Error("This token uses unsupported decimal precision.");
    let symbol = shortAddress(address);
    try {
      symbol = decodeString(symbolValue) || symbol;
    } catch {
      /* Symbol is optional in ERC-20. */
    }
    return { supply, decimals, symbol };
  }
  progress("Reading token supply…");
  const primary = config.tokenAddress.toLowerCase();
  let meta: Awaited<ReturnType<typeof metadata>>;
  try {
    meta = await metadata(primary);
  } catch {
    combined.throwIfAborted();
    throw new Error(
      "Could not read this token. Check the contract address and network. The explorer requires ERC-20 totalSupply() and decimals().",
    );
  }
  interface Log {
    topics: string[];
    data: string;
    transactionHash: string;
    blockNumber: string;
    logIndex: string;
    removed?: boolean;
  }
  const logs: Log[] = [];
  async function readRange(start: number, end: number): Promise<void> {
    combined.throwIfAborted();
    try {
      const result = await rpc("eth_getLogs", [
        {
          address: primary,
          topics: [TRANSFER],
          fromBlock: hex(start),
          toBlock: hex(end),
        },
      ]);
      if (!Array.isArray(result))
        throw new Error("Unexpected transfer response.");
      logs.push(...result);
    } catch (error) {
      combined.throwIfAborted();
      if (end - start < 40) throw error;
      const middle = Math.floor((start + end) / 2);
      await readRange(start, middle);
      await readRange(middle + 1, end);
    }
    if (logs.length > 12000)
      throw new Error(
        "This window contains over 12,000 transfer events. Choose fewer recent blocks and retry.",
      );
  }
  for (let start = fromBlock; start <= block; start += 500) {
    progress(
      `Reading transfers: ${Math.min(start - fromBlock + 500, block - fromBlock + 1).toLocaleString()} of ${(block - fromBlock + 1).toLocaleString()} blocks…`,
    );
    await readRange(start, Math.min(start + 499, block));
  }
  const notices: string[] = [];
  const addressSet = new Set(config.wallets.map((a) => a.toLowerCase()));
  const allCandidates = new Set<string>(addressSet);
  const transfers: {
    from: string;
    to: string;
    value: string;
    tx: string;
    block: number;
  }[] = [];
  const seen = new Set<string>();
  logs.sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)));
  for (const log of logs) {
    if (
      log.removed ||
      log.topics?.length !== 3 ||
      !/^0x[0-9a-f]{64}$/i.test(log.data)
    )
      continue;
    if (!log.topics.slice(1).every((t) => /^0x0{24}[0-9a-f]{40}$/i.test(t)))
      continue;
    const key = `${log.transactionHash}:${log.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const from = "0x" + log.topics[1].slice(-40).toLowerCase();
    const to = "0x" + log.topics[2].slice(-40).toLowerCase();
    for (const address of [from, to]) {
      if (isZero(address)) continue;
      allCandidates.add(address);
      if (addressSet.size < 120) addressSet.add(address);
    }
    if (!isZero(from) && !isZero(to) && from !== to && uint(log.data) > 0n)
      transfers.push({
        from,
        to,
        value: uint(log.data).toString(),
        tx: log.transactionHash,
        block: Number(BigInt(log.blockNumber)),
      });
  }
  if (allCandidates.size > 120)
    notices.push(
      `Read 120 of ${allCandidates.size} discovered wallets, prioritizing your list and recent activity. This is not a complete holder ranking.`,
    );
  progress(`Reading balances for ${addressSet.size} observed wallets…`);
  const balanceResults = await parallelMap(
    [...addressSet],
    6,
    async (address) => {
      try {
        const balance = uint(
          await call(
            primary,
            "balanceOf(address)",
            address.slice(2).padStart(64, "0"),
          ),
        ).toString();
        return {
          id: address,
          address,
          label: shortAddress(address),
          kind: "wallet" as const,
          amount: balance,
          decimals: meta.decimals,
          symbol: meta.symbol,
          cluster: 0,
          tracked: config.wallets.some((a) => a.toLowerCase() === address),
        };
      } catch {
        combined.throwIfAborted();
        return null;
      }
    },
  );
  const failed = balanceResults.filter((n) => n === null).length;
  if (failed)
    notices.push(
      `${failed} wallet balances could not be read and are omitted, not treated as zero.`,
    );
  const wallets = balanceResults
    .filter((n): n is NonNullable<typeof n> => n !== null)
    .sort(byAmount);
  const pinned = wallets.filter((n) => n.tracked);
  const nodes: MapNode[] = [
    ...pinned,
    ...wallets
      .filter((n) => !n.tracked)
      .slice(0, Math.max(0, 80 - pinned.length)),
  ];
  if (wallets.length > nodes.length)
    notices.push(
      `Showing ${nodes.length} wallets: your tracked addresses and the largest observed balances.`,
    );
  const ids = new Set(nodes.map((n) => n.id));
  const edgeMap = new Map<string, MapEdge>();
  transfers
    .filter((t) => ids.has(t.from) && ids.has(t.to))
    .forEach((t) => {
      const key = `${t.from}:${t.to}`;
      const previous = edgeMap.get(key);
      edgeMap.set(key, {
        id: key,
        source: t.from,
        target: t.to,
        kind: "transfer",
        amount: (BigInt(previous?.amount || "0") + BigInt(t.value)).toString(),
        count: (previous?.count || 0) + 1,
        txHash: previous?.txHash || t.tx,
        block: previous?.block || t.block,
      });
    });
  const edges = [...edgeMap.values()];
  const contracts = [
    ...new Set(config.mintableTokens.map((a) => a.toLowerCase())),
  ];
  for (const address of contracts) {
    progress(
      `Reading watched token ${contracts.indexOf(address) + 1} of ${contracts.length}…`,
    );
    try {
      const token = await metadata(address);
      let cap: string | undefined;
      let capMethod: string | undefined;
      for (const signature of ["cap()", "maxSupply()", "MAX_SUPPLY()"]) {
        try {
          cap = uint(await call(address, signature)).toString();
          capMethod = signature;
          break;
        } catch {
          combined.throwIfAborted();
        }
      }
      if (cap !== undefined && BigInt(cap) < BigInt(token.supply)) {
        cap = undefined;
        capMethod = undefined;
      }
      nodes.push({
        id: `token:${address}`,
        address,
        label: token.symbol,
        kind: "token",
        symbol: token.symbol,
        decimals: token.decimals,
        totalSupply: token.supply,
        cap,
        capMethod,
        amount:
          cap !== undefined
            ? (BigInt(cap) - BigInt(token.supply)).toString()
            : "0",
        cluster: 0,
      });
      const holdingWallets = [...pinned, ...wallets.filter((n) => !n.tracked)]
        .filter((n) => ids.has(n.id))
        .slice(0, 40);
      let holdingFailures = 0;
      const holdings = await parallelMap(holdingWallets, 6, async (wallet) => {
        try {
          const value = uint(
            await call(
              address,
              "balanceOf(address)",
              wallet.id.slice(2).padStart(64, "0"),
            ),
          );
          return value > 0n
            ? {
                id: `holding:${wallet.id}:${address}`,
                source: wallet.id,
                target: `token:${address}`,
                kind: "holding" as const,
                amount: value.toString(),
                count: 1,
                token: address,
              }
            : null;
        } catch {
          combined.throwIfAborted();
          holdingFailures++;
          return null;
        }
      });
      edges.push(
        ...holdings.filter((e): e is NonNullable<typeof e> => e !== null),
      );
      if (holdingFailures)
        notices.push(
          `${token.symbol}: ${holdingFailures} ownership reads failed; some holding links may be missing.`,
        );
    } catch {
      combined.throwIfAborted();
      nodes.push({
        id: `token:${address}`,
        address,
        label: shortAddress(address),
        kind: "token",
        symbol: shortAddress(address),
        decimals: 0,
        amount: "0",
        cluster: 0,
        readError:
          "Token supply could not be read. Check this ERC-20 contract and network.",
      });
      notices.push(`Could not read watched token ${shortAddress(address)}.`);
    }
  }
  if (contracts.length && wallets.length > 40)
    notices.push(
      "Watched-token holding links cover up to 40 wallets, prioritizing tracked addresses.",
    );
  const check = (await rpc("eth_getBlockByNumber", [blockTag, false])) as {
    hash?: string;
  } | null;
  if (check?.hash !== blockInfo.hash)
    throw new Error(
      "The snapshot block changed during the read. Refresh to load a consistent snapshot.",
    );
  assignClusters(nodes, edges);
  return {
    mode: "chain",
    nodes,
    edges,
    symbol: meta.symbol,
    decimals: meta.decimals,
    totalSupply: meta.supply,
    fetchedAt: new Date().toISOString(),
    block,
    fromBlock,
    blockHash: blockInfo.hash,
    blockTime: new Date(
      Number(BigInt(blockInfo.timestamp)) * 1000,
    ).toISOString(),
    chainId: config.chainId,
    configKey: configKey(config),
    notices,
  };
}
