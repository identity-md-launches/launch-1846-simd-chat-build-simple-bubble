import test from "node:test";
import assert from "node:assert/strict";
import { illustration } from "../src/illustration";
import { configKey } from "../src/model";
import {
  clearSettings,
  readCache,
  readConfig,
  saveCache,
  saveConfig,
} from "../src/storage";
import type { EcosystemConfig, Snapshot } from "../src/types";
const config: EcosystemConfig = {
  chainId: "1",
  chainName: "Fixture network",
  rpcUrl: "https://rpc.example.invalid",
  tokenAddress: "0x52908400098527886e0f7030069857d2e4169ee7",
  mintableTokens: [],
  wallets: [],
  blockWindow: 100,
};
const snapshot: Snapshot = {
  ...illustration,
  mode: "chain",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  block: 1000,
  fromBlock: 901,
  chainId: "1",
  configKey: configKey(config),
};
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});
test("cache restores only the matching ecosystem", () => {
  assert.ok(saveConfig(config));
  assert.ok(saveCache(snapshot));
  assert.deepEqual(readConfig(), config);
  assert.equal(readCache(config)?.block, 1000);
  assert.equal(readCache({ ...config, chainId: "8453" }), null);
});
test("corrupted cache is ignored instead of crashing the explorer", () => {
  values.set(
    "imd-atlas-snapshot-v1",
    JSON.stringify({ ...snapshot, notices: null }),
  );
  assert.equal(readCache(config), null);
  values.set("imd-atlas-snapshot-v1", "{invalid-json");
  assert.equal(readCache(config), null);
});
test("blocked browser storage has explicit save failure and safe reads", () => {
  const denied = {
    getItem: () => {
      throw new Error("Access denied");
    },
    setItem: () => {
      throw new Error("Access denied");
    },
    removeItem: () => {
      throw new Error("Access denied");
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: denied,
  });
  try {
    assert.equal(saveConfig(config), false);
    assert.equal(saveCache(snapshot), false);
    assert.equal(readConfig(), null);
    assert.equal(readCache(config), null);
    assert.doesNotThrow(clearSettings);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
  }
});
test("clear removes both settings and the saved snapshot", () => {
  saveConfig(config);
  saveCache(snapshot);
  clearSettings();
  assert.equal(readConfig(), null);
  assert.equal(readCache(config), null);
});
