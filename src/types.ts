export interface EcosystemConfig {
  chainId: string;
  chainName: string;
  rpcUrl: string;
  tokenAddress: string;
  mintableTokens: string[];
  wallets: string[];
  blockWindow: number;
}
export interface MapNode {
  id: string;
  label: string;
  address?: string;
  kind: "wallet" | "token";
  amount: string;
  decimals: number;
  symbol: string;
  cluster: number;
  totalSupply?: string;
  cap?: string;
  capMethod?: string;
  readError?: string;
  tracked?: boolean;
}
export interface MapEdge {
  id: string;
  source: string;
  target: string;
  kind: "transfer" | "holding";
  amount: string;
  count: number;
  txHash?: string;
  block?: number;
  token?: string;
}
export interface Snapshot {
  mode: "illustration" | "chain";
  nodes: MapNode[];
  edges: MapEdge[];
  symbol: string;
  decimals: number;
  totalSupply: string;
  fetchedAt?: string;
  block?: number;
  fromBlock?: number;
  blockHash?: string;
  blockTime?: string;
  chainId?: string;
  configKey?: string;
  notices: string[];
}
export interface Filters {
  kind: "all" | "wallet" | "token";
  query: string;
  minShare: number;
  relationship: "all" | "connected" | "isolated" | "selected";
  cluster: number | null;
  showTransfers: boolean;
}
export const defaultFilters: Filters = {
  kind: "all",
  query: "",
  minShare: 0,
  relationship: "all",
  cluster: null,
  showTransfers: true,
};
export const blankConfig: EcosystemConfig = {
  chainId: "",
  chainName: "",
  rpcUrl: "",
  tokenAddress: "",
  mintableTokens: [],
  wallets: [],
  blockWindow: 2000,
};
