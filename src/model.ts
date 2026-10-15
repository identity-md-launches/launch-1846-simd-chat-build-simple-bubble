import type {
  EcosystemConfig,
  Filters,
  MapNode,
  Snapshot,
  MapEdge,
} from "./types";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
export const digest = (value: string) =>
  bytesToHex(keccak_256(new TextEncoder().encode(value)));
export const selector = (signature: string) =>
  "0x" + digest(signature).slice(0, 8);
export const isAddress = (value: string) => {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value))
    return false;
  const body = value.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  const hash = digest(body.toLowerCase());
  return [...body].every(
    (c, i) =>
      !/[a-f]/i.test(c) ||
      c === (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c.toLowerCase()),
  );
};
export const shortAddress = (value: string) =>
  `${value.slice(0, 6)}…${value.slice(-4)}`;
export const share = (amount: string, total: string) =>
  BigInt(total) > 0n
    ? Number((BigInt(amount) * 1000000n) / BigInt(total)) / 10000
    : 0;
export const percentage = (value: number) =>
  value > 0 && value < 0.01
    ? "<0.01%"
    : `${value.toLocaleString("en", { maximumFractionDigits: 2 })}%`;
// Check the original integer amounts before the numeric share rounds away dust.
export function supplyShare(amount: string, total: string): string {
  const balance = BigInt(amount), supply = BigInt(total);
  if (balance > 0n && supply > 0n && balance * 10000n < supply)
    return "<0.01%";
  return percentage(share(amount, total));
}
export function exactAmount(amount: string, decimals: number): string {
  const value = amount.padStart(decimals + 1, "0");
  if (!decimals) return value;
  return (
    (value.slice(0, -decimals) + "." + value.slice(-decimals)).replace(
      /\.?0+$/,
      "",
    ) || "0"
  );
}
export function compactAmount(amount: string, decimals: number): string {
  const value = Number(exactAmount(amount, decimals));
  if (value > 0 && value < 0.01) return "<0.01";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
export const byAmount = (a: MapNode, b: MapNode) => {
  const left = BigInt(a.amount) * 10n ** BigInt(b.decimals);
  const right = BigInt(b.amount) * 10n ** BigInt(a.decimals);
  return left === right ? a.id.localeCompare(b.id) : left > right ? -1 : 1;
};
export function configKey(config: EcosystemConfig) {
  return digest(
    JSON.stringify({
      ...config,
      tokenAddress: config.tokenAddress.toLowerCase(),
      wallets: config.wallets.map((a) => a.toLowerCase()).sort(),
      mintableTokens: config.mintableTokens.map((a) => a.toLowerCase()).sort(),
    }),
  );
}
export function validateConfig(
  config: EcosystemConfig,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!config.chainName.trim())
    errors.chainName = "Enter a name for this network.";
  if (
    !/^[1-9]\d*$/.test(config.chainId) ||
    !Number.isSafeInteger(Number(config.chainId))
  )
    errors.chainId = "Enter the numeric chain ID for your network.";
  try {
    const url = new URL(config.rpcUrl);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error();
  } catch {
    errors.rpcUrl =
      "Enter a public HTTPS RPC URL that permits browser requests.";
  }
  if (!isAddress(config.tokenAddress))
    errors.tokenAddress =
      "Enter a valid, nonzero IMD token contract address. Check mixed-case checksums.";
  if (config.wallets.length > 40 || config.wallets.some((a) => !isAddress(a)))
    errors.wallets =
      "Use up to 40 valid wallet addresses, one per line. Check mixed-case checksums.";
  if (
    config.mintableTokens.length > 8 ||
    config.mintableTokens.some((a) => !isAddress(a))
  )
    errors.mintableTokens =
      "Use up to 8 valid token contracts, one per line. Check mixed-case checksums.";
  if (
    !Number.isInteger(config.blockWindow) ||
    config.blockWindow < 100 ||
    config.blockWindow > 10000
  )
    errors.blockWindow = "Choose between 100 and 10,000 recent blocks.";
  return errors;
}
export function filterGraph(
  snapshot: Snapshot,
  filters: Filters,
  selectedId: string | null,
) {
  const linked = new Set<string>();
  const selectedLinks = new Set<string>(selectedId ? [selectedId] : []);
  snapshot.edges.forEach((edge) => {
    linked.add(edge.source);
    linked.add(edge.target);
    if (edge.source === selectedId) selectedLinks.add(edge.target);
    if (edge.target === selectedId) selectedLinks.add(edge.source);
  });
  const query = filters.query.trim().toLowerCase();
  const nodes = snapshot.nodes.filter((node) => {
    if (filters.kind !== "all" && node.kind !== filters.kind) return false;
    if (
      query &&
      !`${node.label} ${node.address || ""} ${node.symbol}`
        .toLowerCase()
        .includes(query)
    )
      return false;
    if (
      node.kind === "wallet" &&
      share(node.amount, snapshot.totalSupply) < filters.minShare
    )
      return false;
    if (filters.cluster !== null && node.cluster !== filters.cluster)
      return false;
    if (filters.relationship === "connected" && !linked.has(node.id))
      return false;
    if (filters.relationship === "isolated" && linked.has(node.id))
      return false;
    if (filters.relationship === "selected" && !selectedLinks.has(node.id))
      return false;
    return true;
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = snapshot.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );
  return { nodes, edges };
}
export function assignClusters(nodes: MapNode[], edges: MapEdge[]): void {
  const adjacency = new Map(nodes.map((n) => [n.id, new Set<string>()]));
  edges.forEach((e) => {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  });
  const visited = new Set<string>();
  let cluster = 0;
  [...nodes].sort(byAmount).forEach((node) => {
    if (visited.has(node.id)) return;
    const pending = [node.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const target = nodes.find((n) => n.id === id);
      if (target) target.cluster = cluster;
      pending.push(...(adjacency.get(id) || []));
    }
    cluster++;
  });
}
export function makeCsv(snapshot: Snapshot, nodes: MapNode[]) {
  const cells = (values: unknown[]) =>
    values
      .map(
        (v) =>
          '"' +
          String(v ?? "")
            .replace(/^[=+\-@\t\r]/, "'$&")
            .replace(/"/g, '""') +
          '"',
      )
      .join(",");
  const rows = [
    cells([
      "Data mode",
      "Kind",
      "Label",
      "Address",
      "Balance / remaining capacity",
      "Unit",
      "Share of primary supply",
      "Cluster",
      "Block",
      "Read error",
    ]),
  ];
  nodes.forEach((n) =>
    rows.push(
      cells([
        snapshot.mode,
        n.kind,
        n.label,
        n.address,
        n.kind === "token" && n.cap === undefined
          ? "Unknown"
          : exactAmount(n.amount, n.decimals),
        n.symbol,
        n.kind === "wallet"
          ? supplyShare(n.amount, snapshot.totalSupply)
          : "",
        n.cluster + 1,
        snapshot.block,
        n.readError,
      ]),
    ),
  );
  return "\uFEFF" + rows.join("\r\n");
}
export function downloadCsv(snapshot: Snapshot, nodes: MapNode[]) {
  const url = URL.createObjectURL(
    new Blob([makeCsv(snapshot, nodes)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `imd-atlas-${snapshot.mode}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
