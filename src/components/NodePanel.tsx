import { useEffect, useState } from "react";
import type { MapNode, Snapshot } from "../types";
import {
  byAmount,
  compactAmount,
  exactAmount,
  supplyShare,
} from "../model";
import { palette } from "./BubbleMap";
import { Icon } from "./Icon";
export function NodePanel({
  snapshot,
  nodes,
  selected,
  onSelect,
  onFollow,
  onConfigure,
}: {
  snapshot: Snapshot;
  nodes: MapNode[];
  selected: MapNode | null;
  onSelect: (id: string | null) => void;
  onFollow: () => void;
  onConfigure: () => void;
}) {
  const [tab, setTab] = useState<"wallet" | "token">("wallet");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    setCopied(false);
    setCopyError(false);
  }, [selected?.id]);
  const list = nodes.filter((n) => n.kind === tab).sort(byAmount);
  const connected = selected
    ? snapshot.edges.filter(
        (e) => e.source === selected.id || e.target === selected.id,
      )
    : [];
  if (selected)
    return (
      <aside className="node-panel" aria-label="Selected node details">
        <div className="panel-heading">
          <span className="detail-kind">
            <Icon name={selected.kind === "wallet" ? "wallet" : "token"} />
            {selected.kind === "wallet" ? "Wallet details" : "Token details"}
          </span>
          <button
            className="icon-button"
            aria-label="Close node details"
            onClick={() => onSelect(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="node-detail">
          <span className="cluster-caption">
            <i
              style={{
                background: palette[selected.cluster % palette.length].dot,
              }}
            />
            Cluster {selected.cluster + 1}
          </span>
          <h3>{selected.label}</h3>
          {selected.address ? (
            <div className="full-address">
              <code>{selected.address}</code>
              <button
                className="icon-button"
                aria-label="Copy address"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selected.address!);
                    setCopied(true);
                    setCopyError(false);
                  } catch {
                    setCopied(false);
                    setCopyError(true);
                  }
                }}
              >
                <Icon name={copied ? "check" : "copy"} size={16} />
              </button>
            </div>
          ) : (
            <p className="muted small">Illustrative node · no real address</p>
          )}
          <p className="small" role="status">
            {copied
              ? "Address copied"
              : copyError
                ? "Copy unavailable. Select and copy the full address above."
                : ""}
          </p>
          {selected.readError ? (
            <p className="error-text">{selected.readError}</p>
          ) : (
            <>
              <div className="detail-amount">
                <span>
                  {selected.kind === "wallet"
                    ? "Token balance"
                    : "Remaining capacity"}
                </span>
                <strong>
                  {selected.kind === "token" && selected.cap === undefined
                    ? "Unknown"
                    : compactAmount(selected.amount, selected.decimals)}
                </strong>
                <span>{selected.symbol}</span>
              </div>
              <dl className="detail-stats">
                {selected.kind === "wallet" ? (
                  <div>
                    <dt>Share of supply</dt>
                    <dd>
                      {supplyShare(selected.amount, snapshot.totalSupply)}
                    </dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt>Current supply</dt>
                      <dd>
                        {compactAmount(
                          selected.totalSupply || "0",
                          selected.decimals,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Supply cap</dt>
                      <dd>
                        {selected.cap
                          ? compactAmount(selected.cap, selected.decimals)
                          : "Not available"}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>Connections</dt>
                  <dd>
                    {
                      new Set(
                        connected
                          .flatMap((e) => [e.source, e.target])
                          .filter((id) => id !== selected.id),
                      ).size
                    }
                  </dd>
                </div>
              </dl>
              <details className="exact-value">
                <summary>View exact values</summary>
                <p>
                  {selected.kind === "wallet" ? "Balance" : "Capacity"}:{" "}
                  <code>
                    {selected.kind === "token" && !selected.cap
                      ? "Unknown"
                      : exactAmount(selected.amount, selected.decimals)}
                  </code>
                </p>
                {selected.totalSupply && (
                  <p>
                    Total supply:{" "}
                    <code>
                      {exactAmount(selected.totalSupply, selected.decimals)}
                    </code>
                  </p>
                )}
                {selected.cap && (
                  <p>
                    Cap:{" "}
                    <code>{exactAmount(selected.cap, selected.decimals)}</code>{" "}
                    via {selected.capMethod}
                  </p>
                )}
              </details>
            </>
          )}
          <button className="button secondary follow-button" onClick={onFollow}>
            <Icon name="network" />
            Focus connections
          </button>
          {connected.length > 0 && (
            <div className="connection-list">
              <h4>Connected nodes</h4>
              {connected.map((edge) => {
                const other = snapshot.nodes.find(
                  (n) =>
                    n.id ===
                    (edge.source === selected.id ? edge.target : edge.source),
                );
                return (
                  other && (
                    <button
                      key={edge.id}
                      className="connection-row"
                      onClick={() => onSelect(other.id)}
                    >
                      <span>
                        {other.label}
                        <small>
                          {edge.kind === "holding"
                            ? "Token holding"
                            : `${edge.source === selected.id ? "Sent" : "Received"} ${compactAmount(edge.amount, snapshot.decimals)} ${snapshot.symbol} · ${edge.count} transfers`}
                        </small>
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  )
                );
              })}
            </div>
          )}
          {selected.kind === "token" && (
            <p className="panel-note">
              Supply capacity does not confirm that public minting is open.
              Permissions and mint conditions need contract-specific checks.
            </p>
          )}
        </div>
      </aside>
    );
  return (
    <aside className="node-panel" aria-label="Node rankings">
      <div
        className="panel-tabs"
        role="tablist"
        aria-label="Node rankings"
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "wallet"
                : event.key === "End"
                  ? "token"
                  : tab === "wallet"
                    ? "token"
                    : "wallet";
            setTab(next);
            document.getElementById(`rank-${next}`)?.focus();
          }
        }}
      >
        <button
          role="tab"
          tabIndex={tab === "wallet" ? 0 : -1}
          aria-selected={tab === "wallet"}
          id="rank-wallet"
          aria-controls="rankings"
          onClick={() => setTab("wallet")}
        >
          Top holders
        </button>
        <button
          role="tab"
          tabIndex={tab === "token" ? 0 : -1}
          aria-selected={tab === "token"}
          id="rank-token"
          aria-controls="rankings"
          onClick={() => setTab("token")}
        >
          Mintable tokens
        </button>
      </div>
      <div id="rankings" role="tabpanel" aria-labelledby={`rank-${tab}`}>
        <div className="rank-caption">
          <span>
            {tab === "wallet" ? "By token balance" : "By remaining capacity"}
          </span>
          <span>
            {list.length} {tab === "wallet" ? "wallets" : "tokens"}
          </span>
        </div>
        <ol className="rank-list">
          {list.slice(0, 6).map((node, i) => (
            <li key={node.id}>
              <button className="rank-row" onClick={() => onSelect(node.id)}>
                <span className="rank-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="rank-orb"
                  style={{
                    background: palette[node.cluster % palette.length].fill,
                    borderColor: palette[node.cluster % palette.length].stroke,
                  }}
                >
                  {node.kind === "token" && <Icon name="token" size={14} />}
                </span>
                <span className="rank-name">
                  {node.label}
                  <small>
                    {node.kind === "wallet"
                      ? `Cluster ${node.cluster + 1}`
                      : node.readError
                        ? "Read unavailable"
                        : node.cap
                          ? "Capacity found"
                          : "Capacity unknown"}
                  </small>
                </span>
                <span className="rank-value">
                  {node.kind === "wallet"
                    ? supplyShare(node.amount, snapshot.totalSupply)
                    : node.cap
                      ? compactAmount(node.amount, node.decimals)
                      : "Unknown"}
                  <small>
                    {node.kind === "wallet"
                      ? `${compactAmount(node.amount, node.decimals)} ${node.symbol}`
                      : node.symbol}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!list.length && (
          <div className="panel-empty">
            <Icon name={tab === "wallet" ? "wallet" : "token"} size={28} />
            <p>
              {tab === "wallet"
                ? "No wallets match this view."
                : "No watched tokens in this view."}
            </p>
            {tab === "token" && (
              <button className="button secondary" onClick={onConfigure}>
                Add token contracts
              </button>
            )}
          </div>
        )}
        <p className="panel-note">
          {snapshot.mode === "illustration"
            ? "Example values for exploring the map. Add addresses to see on-chain data."
            : tab === "wallet"
              ? "Ranked within the observed wallets, not all holders. Percentages use the token’s total supply."
              : "Watchlist supplied by you. A readable cap shows capacity, not permission to mint."}
        </p>
        <a className="panel-link" href="#/explorer">
          View all in data explorer
          <Icon name="arrow" size={16} />
        </a>
      </div>
    </aside>
  );
}
