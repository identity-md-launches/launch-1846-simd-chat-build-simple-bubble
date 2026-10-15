import { configKey, validateConfig } from "./model";
import type { EcosystemConfig, Snapshot } from "./types";
const CONFIG_KEY = "imd-atlas-config-v1";
const CACHE_KEY = "imd-atlas-snapshot-v1";
export function readConfig(): EcosystemConfig | null {
  try {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    return config && !Object.keys(validateConfig(config)).length
      ? config
      : null;
  } catch {
    return null;
  }
}
export function saveConfig(config: EcosystemConfig): boolean {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}
export function readCache(config: EcosystemConfig): Snapshot | null {
  try {
    const snapshot = JSON.parse(
      localStorage.getItem(CACHE_KEY) || "null",
    ) as Snapshot | null;
    if (
      !snapshot ||
      snapshot.mode !== "chain" ||
      snapshot.configKey !== configKey(config) ||
      !Array.isArray(snapshot.nodes) ||
      snapshot.nodes.length > 88 ||
      !Array.isArray(snapshot.edges) ||
      snapshot.edges.length > 20000 ||
      !/^\d+$/.test(snapshot.totalSupply) ||
      !snapshot.fetchedAt ||
      !Number.isFinite(Date.parse(snapshot.fetchedAt))
    )
      return null;
    if (
      !Array.isArray(snapshot.notices) ||
      !snapshot.notices.every((n) => typeof n === "string") ||
      typeof snapshot.symbol !== "string" ||
      !Number.isInteger(snapshot.decimals) ||
      snapshot.decimals < 0 ||
      snapshot.decimals > 36 ||
      !Number.isSafeInteger(snapshot.block) ||
      !Number.isSafeInteger(snapshot.fromBlock) ||
      snapshot.chainId !== config.chainId
    )
      return null;
    if (
      !snapshot.nodes.every(
        (n) =>
          typeof n.id === "string" &&
          typeof n.label === "string" &&
          typeof n.symbol === "string" &&
          /^\d+$/.test(n.amount) &&
          Number.isInteger(n.decimals) &&
          n.decimals >= 0 &&
          n.decimals <= 36 &&
          Number.isInteger(n.cluster) &&
          n.cluster >= 0 &&
          (n.cap === undefined || /^\d+$/.test(n.cap)) &&
          (n.totalSupply === undefined || /^\d+$/.test(n.totalSupply)) &&
          ["wallet", "token"].includes(n.kind),
      )
    )
      return null;
    const ids = new Set(snapshot.nodes.map((n) => n.id));
    if (
      !snapshot.edges.every(
        (e) =>
          typeof e.id === "string" &&
          ids.has(e.source) &&
          ids.has(e.target) &&
          /^\d+$/.test(e.amount) &&
          ["holding", "transfer"].includes(e.kind),
      )
    )
      return null;
    return snapshot;
  } catch {
    return null;
  }
}
export function saveCache(snapshot: Snapshot): boolean {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
export function clearSettings() {
  try {
    localStorage.removeItem(CONFIG_KEY);
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* The current session can still reset. */
  }
}
