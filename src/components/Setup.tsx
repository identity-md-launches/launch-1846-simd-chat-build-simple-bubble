import { useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import type { EcosystemConfig } from "../types";
import { validateConfig } from "../model";
export function Setup({
  config,
  onClose,
  onSave,
}: {
  config: EcosystemConfig;
  onClose: () => void;
  onSave: (config: EcosystemConfig) => void;
}) {
  const [form, setForm] = useState(config);
  const [walletText, setWalletText] = useState(config.wallets.join("\n"));
  const [tokenText, setTokenText] = useState(config.mintableTokens.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof EcosystemConfig, value: string | number) =>
    setForm((v) => ({ ...v, [key]: value }));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const split = (value: string) => [
      ...new Set(
        value
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    const next = {
      ...form,
      chainId: form.chainId.trim(),
      chainName: form.chainName.trim(),
      rpcUrl: form.rpcUrl.trim(),
      tokenAddress: form.tokenAddress.trim(),
      wallets: split(walletText),
      mintableTokens: split(tokenText),
    };
    const invalid = validateConfig(next);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      requestAnimationFrame(() =>
        document.getElementById(`setup-${Object.keys(invalid)[0]}`)?.focus(),
      );
      return;
    }
    onSave(next);
  }
  const attrs = (key: string) => ({
    id: `setup-${key}`,
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `error-${key}` : undefined,
  });
  const error = (key: string) =>
    errors[key] ? (
      <span className="field-error" id={`error-${key}`}>
        {errors[key]}
      </span>
    ) : null;
  return (
    <Modal title="Add your ecosystem" onClose={onClose} wide>
      <p className="modal-intro">
        Add the IMD contract and addresses you want to explore. Everything is
        read-only; no wallet connection needed.
      </p>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <label>
            Network name
            <input
              {...attrs("chainName")}
              value={form.chainName}
              onChange={(e) => set("chainName", e.target.value)}
              placeholder="Name of your network"
              autoComplete="off"
              maxLength={60}
            />
            {error("chainName")}
          </label>
          <label>
            Chain ID
            <input
              {...attrs("chainId")}
              value={form.chainId}
              onChange={(e) => set("chainId", e.target.value)}
              placeholder="Numeric network ID"
              inputMode="numeric"
              autoComplete="off"
            />
            {error("chainId")}
          </label>
        </div>
        <label>
          Public RPC URL
          <input
            {...attrs("rpcUrl")}
            type="url"
            value={form.rpcUrl}
            onChange={(e) => set("rpcUrl", e.target.value)}
            placeholder="HTTPS endpoint for this network"
            autoComplete="off"
            spellCheck={false}
          />
          {error("rpcUrl")}
          <span className="field-hint">
            Use an endpoint that allows browser requests. Do not enter a private
            API key.
          </span>
        </label>
        <label>
          IMD token contract
          <input
            {...attrs("tokenAddress")}
            value={form.tokenAddress}
            onChange={(e) => set("tokenAddress", e.target.value)}
            placeholder="Paste the full contract address"
            autoComplete="off"
            spellCheck={false}
          />
          {error("tokenAddress")}
        </label>
        <div className="form-grid">
          <label>
            Mintable token contracts <span className="optional">Optional</span>
            <textarea
              {...attrs("mintableTokens")}
              value={tokenText}
              onChange={(e) => setTokenText(e.target.value)}
              placeholder="One ERC-20 address per line"
              rows={3}
              spellCheck={false}
            />
            {error("mintableTokens")}
            <span className="field-hint">
              Up to 8 contracts. Available capacity is shown when a supply cap
              is readable.
            </span>
          </label>
          <label>
            Wallets to include <span className="optional">Optional</span>
            <textarea
              {...attrs("wallets")}
              value={walletText}
              onChange={(e) => setWalletText(e.target.value)}
              placeholder="One wallet address per line"
              rows={3}
              spellCheck={false}
            />
            {error("wallets")}
            <span className="field-hint">
              Up to 40 wallets. Recent transfer participants are discovered
              automatically.
            </span>
          </label>
        </div>
        <label>
          Recent blocks to scan
          <select
            {...attrs("blockWindow")}
            value={form.blockWindow}
            onChange={(e) => set("blockWindow", Number(e.target.value))}
          >
            <option value={100}>100 blocks · quickest</option>
            <option value={500}>500 blocks</option>
            <option value={2000}>2,000 blocks · recommended</option>
            <option value={10000}>10,000 blocks · wider view</option>
          </select>
          {error("blockWindow")}
        </label>
        <p className="privacy-note">
          <Icon name="info" /> Settings and the latest snapshot stay in this
          browser. Reads are sent to your chosen RPC.
        </p>
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            Load recent data
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
