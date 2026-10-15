import type { MapNode, MapEdge, Snapshot } from "./types";
// Diagram-only values. No addresses, transaction hashes, timestamps or chain IDs are fabricated.
const groups = [
  [18500000, 5200000, 2800000, 1600000, 900000, 550000, 260000, 160000, 80000],
  [11200000, 3600000, 1900000, 800000, 420000, 190000],
  [7600000, 3200000, 1300000, 650000, 310000, 120000],
  [5900000, 2100000, 1100000, 480000, 220000],
];
const nodes: MapNode[] = [];
const edges: MapEdge[] = [];
let index = 0;
groups.forEach((amounts, cluster) => {
  const first = index;
  amounts.forEach((amount, i) => {
    index++;
    const id = `illustration-wallet-${index}`;
    nodes.push({
      id,
      label: `Wallet ${String(index).padStart(2, "0")}`,
      kind: "wallet",
      amount: String(amount),
      decimals: 0,
      symbol: "IMD",
      cluster,
    });
    if (i > 0)
      edges.push({
        id: `illustration-flow-${index}`,
        source: `illustration-wallet-${i > 3 ? first + 2 : first + 1}`,
        target: id,
        kind: "transfer",
        amount: String(Math.round(amount / 6)),
        count: i + 1,
      });
  });
});
[24000000, 12000000, 6000000].forEach((amount, i) => {
  const id = `illustration-token-${i + 1}`;
  nodes.push({
    id,
    label: `Token ${String.fromCharCode(65 + i)}`,
    kind: "token",
    amount: String(amount),
    decimals: 0,
    symbol: `Token ${String.fromCharCode(65 + i)}`,
    cluster: i,
    totalSupply: String(30000000 - amount),
    cap: "30000000",
    capMethod: "cap()",
  });
  edges.push({
    id: `illustration-holding-${i}`,
    source: `illustration-wallet-${[1, 10, 16][i]}`,
    target: id,
    kind: "holding",
    amount: "120000",
    count: 1,
  });
});
export const illustration: Snapshot = {
  mode: "illustration",
  nodes,
  edges,
  symbol: "IMD",
  decimals: 0,
  totalSupply: "100000000",
  notices: [
    "Illustrative values only. These wallets, holdings, and tokens do not represent on-chain activity. Add addresses to load your ecosystem.",
  ],
};
