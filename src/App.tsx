import { useEffect, useMemo, useRef, useState } from "react";
import { BubbleMap, palette } from "./components/BubbleMap";
import { Icon } from "./components/Icon";
import { Modal } from "./components/Modal";
import { NodePanel } from "./components/NodePanel";
import { Setup } from "./components/Setup";
import { illustration } from "./illustration";
import {
  byAmount,
  compactAmount,
  downloadCsv,
  filterGraph,
  percentage,
  share,
  validateConfig,
} from "./model";
import { loadSnapshot } from "./rpc";
import {
  clearSettings,
  readCache,
  readConfig,
  saveCache,
  saveConfig,
} from "./storage";
import {
  blankConfig,
  defaultFilters,
  type EcosystemConfig,
  type Filters,
  type Snapshot,
} from "./types";
const routeFromHash = () =>
  location.hash.startsWith("#/explorer") ? "explorer" : "home";
function App() {
  const [page, setPage] = useState(routeFromHash);
  const [config, setConfig] = useState<EcosystemConfig>(blankConfig);
  const [snapshot, setSnapshot] = useState<Snapshot>(illustration);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<
    "setup" | "help" | "source" | "reset" | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [storageNote, setStorageNote] = useState("");
  const [isCached, setIsCached] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const intro = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    const navigate = () => {
      setPage(routeFromHash());
      setSelected(null);
      setFilters(defaultFilters);
      window.scrollTo(0, 0);
      requestAnimationFrame(() => intro.current?.focus());
    };
    window.addEventListener("hashchange", navigate);
    const saved = readConfig();
    if (saved) {
      setConfig(saved);
      const cached = readCache(saved);
      if (cached) {
        setSnapshot(cached);
        setIsCached(true);
      }
    } else {
      const controller = new AbortController();
      fetch("./ecosystem.json", { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((value: EcosystemConfig | null) => {
          if (
            mounted.current &&
            value &&
            !Object.keys(validateConfig(value)).length
          )
            setConfig(value);
        })
        .catch(() => {
          /* An unconfigured static deployment starts in the illustration. */
        });
    }
    return () => {
      mounted.current = false;
      window.removeEventListener("hashchange", navigate);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    document.title =
      page === "explorer"
        ? "Data explorer · IMD Atlas"
        : "IMD Atlas · Explore the ecosystem";
  }, [page]);
  const configured = !Object.keys(validateConfig(config)).length;
  const preview = snapshot.mode === "illustration";
  const filtered = useMemo(
    () => filterGraph(snapshot, filters, selected),
    [snapshot, filters, selected],
  );
  const selectedNode = snapshot.nodes.find((n) => n.id === selected) || null;
  const clusters = [...new Set(snapshot.nodes.map((n) => n.cluster))].sort(
    (a, b) => a - b,
  );
  const wallets = snapshot.nodes.filter((n) => n.kind === "wallet");
  const tokens = snapshot.nodes.filter((n) => n.kind === "token");
  const transferCount = snapshot.edges
    .filter((e) => e.kind === "transfer")
    .reduce((sum, e) => sum + e.count, 0);
  const activeFilters =
    filters.kind !== "all" ||
    filters.query !== "" ||
    filters.minShare > 0 ||
    filters.relationship !== "all" ||
    filters.cluster !== null;
  const resetFilters = () => {
    setFilters(defaultFilters);
    setSelected(null);
  };
  function selectNode(id: string | null) {
    setSelected(id);
    if (!id && filters.relationship === "selected")
      setFilter("relationship", "all");
    if (id && window.innerWidth <= 900)
      requestAnimationFrame(() =>
        document
          .querySelector(".node-panel")
          ?.scrollIntoView({ block: "nearest", behavior: "instant" }),
      );
  }
  async function refresh(nextConfig = config) {
    if (Object.keys(validateConfig(nextConfig)).length) {
      setModal("setup");
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError("");
    setProgress("Connecting to your network…");
    try {
      const next = await loadSnapshot(nextConfig, controller.signal, (text) => {
        if (!controller.signal.aborted) setProgress(text);
      });
      if (controller.signal.aborted || !mounted.current) return;
      setSnapshot(next);
      setIsCached(false);
      setSelected(null);
      setFilters(defaultFilters);
      if (!saveCache(next))
        setStorageNote(
          "This browser could not save the snapshot. You can still explore it in this session.",
        );
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current)
        setError(
          cause instanceof Error && cause.name !== "TimeoutError"
            ? cause.message
            : "The read took too long. Try fewer blocks or a different public RPC endpoint.",
        );
    } finally {
      if (abort.current === controller && mounted.current) {
        setLoading(false);
        setProgress("");
      }
    }
  }
  function save(next: EcosystemConfig) {
    abort.current?.abort();
    setConfig(next);
    setSnapshot(illustration);
    setIsCached(false);
    setSelected(null);
    setFilters(defaultFilters);
    setModal(null);
    setStorageNote(
      saveConfig(next)
        ? ""
        : "This browser could not save the settings. They remain available for this session.",
    );
    void refresh(next);
  }
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#/" className="brand" aria-label="IMD Atlas home">
            <span className="brand-mark">
              <Icon name="network" size={27} />
            </span>
            <span className="brand-word">
              imd<span className="brand-atlas">atlas</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a
              className={page === "home" ? "active" : ""}
              aria-current={page === "home" ? "page" : undefined}
              href="#/"
            >
              Overview
            </a>
            <a
              className={page === "explorer" ? "active" : ""}
              aria-current={page === "explorer" ? "page" : undefined}
              href="#/explorer"
            >
              Data explorer
            </a>
          </nav>
          <div className="header-actions">
            <button
              className="help-button"
              onClick={() => setModal("help")}
              aria-label="How to use the map"
            >
              <Icon name="help" />
              <span>How it works</span>
            </button>
            <button
              className="button secondary header-add"
              onClick={() => setModal("setup")}
            >
              <Icon name="plus" />
              <span>{configured ? "Edit addresses" : "Add addresses"}</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="page-intro">
          <div>
            <h1 ref={intro} tabIndex={-1}>
              {page === "home" ? (
                <>
                  Every connection, <span>in view.</span>
                </>
              ) : (
                "Data explorer"
              )}
            </h1>
            <p>
              {page === "home"
                ? "Explore IMD holders, token supply, and the wallets connecting them."
                : "Find wallets, filter holdings, and follow token transfers."}
            </p>
          </div>
          {page === "home" ? (
            <a href="#/explorer" className="button primary">
              Explore the ecosystem
              <Icon name="arrow" />
            </a>
          ) : (
            <button
              className="button primary"
              onClick={() => setModal("setup")}
            >
              <Icon name="plus" />
              {configured ? "Edit addresses" : "Add your addresses"}
            </button>
          )}
        </section>
        <div className="source-strip">
          <span className={`source-status ${preview ? "preview-status" : ""}`}>
            <span className="status-dot" />
            {preview
              ? "Illustrative preview"
              : `${isCached ? "Saved snapshot" : "On-chain snapshot"} · ${config.chainName}`}
          </span>
          <span className="source-description">
            {preview
              ? "Add addresses to load your ecosystem."
              : `Block ${snapshot.block?.toLocaleString()} · ${new Date(snapshot.fetchedAt!).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`}
          </span>
          <button
            className="text-button source-link"
            onClick={() => setModal(preview ? "setup" : "source")}
          >
            {preview ? "Set up data" : "View data source"}
            <Icon name="arrow" size={14} />
          </button>
        </div>
        <div
          className="stats-strip"
          aria-label={
            preview ? "Illustrative dataset summary" : "Snapshot summary"
          }
        >
          <div className="stat">
            <span>
              <Icon name="wallet" />
              Observed wallets
            </span>
            <strong>
              {wallets.length}
              <small>{preview ? "example holders" : "in this snapshot"}</small>
            </strong>
          </div>
          <div className="stat">
            <span>
              <Icon name="network" />
              Transfer links
            </span>
            <strong>
              {snapshot.edges.filter((e) => e.kind === "transfer").length}
              <small>
                {preview
                  ? "example connections"
                  : `${transferCount.toLocaleString()} transfers`}
              </small>
            </strong>
          </div>
          <div className="stat">
            <span>
              <Icon name="filter" />
              Connected clusters
            </span>
            <strong>
              {clusters.length}
              <small>groups of linked nodes</small>
            </strong>
          </div>
          <div className="stat">
            <span>
              <Icon name="token" />
              Watched tokens
            </span>
            <strong>
              {tokens.length}
              <small>
                {preview ? "example contracts" : "supplied contracts"}
              </small>
            </strong>
          </div>
        </div>
        <div className="operation-status" role="status">
          {loading && (
            <div className="loading-note">
              <Icon name="refresh" className="spinning" />
              <span>{progress}</span>
              <button
                className="text-button"
                onClick={() => {
                  abort.current?.abort();
                  setLoading(false);
                  setProgress("");
                }}
              >
                Cancel read
              </button>
            </div>
          )}
          {storageNote && <p className="storage-note">{storageNote}</p>}
          {!preview && snapshot.notices.length > 0 && (
            <div className="data-note">
              <Icon name="info" size={16} />
              <span>This snapshot has data limitations.</span>
              <button
                className="text-button"
                onClick={() => setModal("source")}
              >
                Review data notes
                <Icon name="arrow" size={14} />
              </button>
            </div>
          )}
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <Icon name="info" />
            <div>
              <strong>Could not load recent data</strong>
              <p>{error}</p>
              <span>
                {preview
                  ? "The illustration is still displayed."
                  : "The previous snapshot is still displayed."}
              </span>
            </div>
            <button
              className="button secondary"
              disabled={loading}
              onClick={() => void refresh()}
            >
              Try again
            </button>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        <section className="explorer-surface" aria-labelledby="map-heading">
          <div className="surface-heading">
            <div>
              <Icon name="network" size={21} />
              <h2 id="map-heading">Ecosystem map</h2>
              <span className="count-label">{filtered.nodes.length} nodes</span>
            </div>
            <div>
              <button
                className="text-button refresh-button"
                aria-label={configured ? "Refresh data" : "Load data"}
                disabled={loading}
                onClick={() => void refresh()}
              >
                <Icon name="refresh" size={16} />
                <span>{configured ? "Refresh data" : "Load data"}</span>
              </button>
              <button
                className="icon-button"
                aria-label="Map guide"
                onClick={() => setModal("help")}
              >
                <Icon name="help" />
              </button>
            </div>
          </div>
          <div className="map-toolbar">
            <div className="segmented" role="group" aria-label="Node type">
              {(["all", "wallet", "token"] as const).map((kind) => (
                <button
                  key={kind}
                  aria-pressed={filters.kind === kind}
                  onClick={() => setFilter("kind", kind)}
                >
                  {kind === "all"
                    ? "All nodes"
                    : kind === "wallet"
                      ? "Wallets"
                      : "Tokens"}
                </button>
              ))}
            </div>
            <div className="toolbar-right">
              <label className="connection-toggle">
                <input
                  type="checkbox"
                  checked={filters.showTransfers}
                  onChange={(e) => setFilter("showTransfers", e.target.checked)}
                />
                <span className="switch" />
                Show connections
              </label>
              <button
                className="button secondary filter-toggle"
                aria-expanded={showMobileFilters}
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                <Icon name="filter" />
                Filters{activeFilters && <span className="active-filter-dot" />}
              </button>
            </div>
          </div>
          <div
            className={`filter-bar ${page === "explorer" ? "explorer-filters" : ""} ${showMobileFilters ? "filters-open" : ""}`}
          >
            <label className="search-field">
              <Icon name="search" size={17} />
              <span className="sr-only">Search wallets or tokens</span>
              <input
                type="search"
                value={filters.query}
                placeholder="Search wallet or token"
                onChange={(e) => setFilter("query", e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="select-field">
              <span>Holding size</span>
              <select
                value={filters.minShare}
                onChange={(e) => setFilter("minShare", Number(e.target.value))}
              >
                <option value={0}>All holdings</option>
                <option value={0.1}>At least 0.1% of supply</option>
                <option value={1}>At least 1% of supply</option>
                <option value={5}>At least 5% of supply</option>
                <option value={10}>At least 10% of supply</option>
              </select>
            </label>
            <label className="select-field">
              <span>Relationships</span>
              <select
                value={filters.relationship}
                onChange={(e) =>
                  setFilter(
                    "relationship",
                    e.target.value as Filters["relationship"],
                  )
                }
              >
                <option value="all">All relationships</option>
                <option value="connected">Connected nodes</option>
                <option value="isolated">Isolated nodes</option>
                <option value="selected" disabled={!selected}>
                  Selected node + neighbors
                </option>
              </select>
            </label>
            <label className="connection-toggle mobile-connections">
              <input
                type="checkbox"
                checked={filters.showTransfers}
                onChange={(e) => setFilter("showTransfers", e.target.checked)}
              />
              <span className="switch" />
              Show connections
            </label>
            {activeFilters && (
              <button
                className="text-button reset-filters"
                onClick={resetFilters}
              >
                Reset filters
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          {filters.relationship === "selected" && !selected && (
            <p className="filter-notice">
              Select a node from the table after resetting filters, then choose
              “Focus connections” in its details.
            </p>
          )}
          <div className="map-and-panel">
            <div className="map-column">
              <BubbleMap
                nodes={filtered.nodes}
                allNodes={snapshot.nodes}
                edges={filtered.edges}
                selected={selected}
                onSelect={selectNode}
                showTransfers={filters.showTransfers}
                totalSupply={snapshot.totalSupply}
                onResetFilters={resetFilters}
              />
              <div className="map-legend">
                <div className="cluster-legend">
                  <span>Clusters</span>
                  {clusters.slice(0, 5).map((cluster) => (
                    <button
                      key={cluster}
                      aria-pressed={filters.cluster === cluster}
                      aria-label={`Filter cluster ${cluster + 1}`}
                      onClick={() =>
                        setFilter(
                          "cluster",
                          filters.cluster === cluster ? null : cluster,
                        )
                      }
                    >
                      <i
                        style={{
                          background: palette[cluster % palette.length].dot,
                        }}
                      />
                      <span>{cluster + 1}</span>
                    </button>
                  ))}
                  {clusters.length > 5 && (
                    <label className="sr-legend">
                      <span className="sr-only">More clusters</span>
                      <select
                        value={
                          filters.cluster !== null && filters.cluster >= 5
                            ? filters.cluster
                            : ""
                        }
                        onChange={(e) =>
                          setFilter(
                            "cluster",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">More clusters</option>
                        {clusters.slice(5).map((c) => (
                          <option key={c} value={c}>
                            Cluster {c + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="edge-legend">
                  <span>
                    <i className="line solid" />
                    Transfer
                  </span>
                  <span>
                    <i className="line dashed" />
                    Holding
                  </span>
                </div>
              </div>
            </div>
            <NodePanel
              snapshot={snapshot}
              nodes={filtered.nodes}
              selected={selectedNode}
              onSelect={selectNode}
              onFollow={() => {
                setFilter("relationship", "selected");
                setFilter("query", "");
                setFilter("kind", "all");
                setFilter("cluster", null);
                setFilter("minShare", 0);
              }}
              onConfigure={() => setModal("setup")}
            />
          </div>
          <div className="surface-footer">
            <span role="status">
              Showing {filtered.nodes.length} of {snapshot.nodes.length} nodes ·{" "}
              {filtered.edges.length} connections
            </span>
            <span>
              Bubbles show relative size; token units differ.
              <button
                className="text-button"
                onClick={() => setModal("source")}
              >
                About the data
                <Icon name="external" size={13} />
              </button>
            </span>
          </div>
        </section>
        {page === "explorer" && (
          <section className="data-section" aria-labelledby="table-heading">
            <div className="section-heading">
              <div>
                <h2 id="table-heading">
                  {filters.kind === "token"
                    ? "Watched tokens"
                    : "Wallets & tokens"}
                </h2>
                <p>
                  {preview
                    ? "Illustrative values. No real wallet addresses are shown."
                    : "Balances at the snapshot block, within the observed set."}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => downloadCsv(snapshot, filtered.nodes)}
                disabled={!filtered.nodes.length}
              >
                <Icon name="download" />
                Export CSV
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Node</th>
                    <th scope="col">Type</th>
                    <th scope="col">Balance / capacity</th>
                    <th scope="col">Supply share</th>
                    <th scope="col">Cluster</th>
                    <th scope="col">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered.nodes]
                    .sort(
                      (a, b) => a.kind.localeCompare(b.kind) || byAmount(a, b),
                    )
                    .map((node) => (
                      <tr
                        key={node.id}
                        className={selected === node.id ? "selected-row" : ""}
                      >
                        <td>
                          <button
                            className="table-node"
                            onClick={() => {
                              selectNode(node.id);
                              document
                                .querySelector(".node-panel")
                                ?.scrollIntoView({
                                  block: "nearest",
                                  behavior: "instant",
                                });
                            }}
                          >
                            <i
                              style={{
                                background:
                                  palette[node.cluster % palette.length].dot,
                              }}
                            />
                            {node.label}
                          </button>
                          {node.tracked && (
                            <span className="tracked-label">Tracked</span>
                          )}
                        </td>
                        <td>{node.kind === "wallet" ? "Wallet" : "Token"}</td>
                        <td>
                          {node.kind === "token" && node.cap === undefined
                            ? "Unknown"
                            : `${compactAmount(node.amount, node.decimals)} ${node.symbol}`}
                        </td>
                        <td>
                          {node.kind === "wallet"
                            ? percentage(
                                share(node.amount, snapshot.totalSupply),
                              )
                            : "Not comparable"}
                        </td>
                        <td>{node.cluster + 1}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`View details for ${node.label}`}
                            onClick={() => {
                              selectNode(node.id);
                              document
                                .querySelector(".node-panel")
                                ?.scrollIntoView({
                                  block: "nearest",
                                  behavior: "instant",
                                });
                            }}
                          >
                            <Icon name="arrow" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!filtered.nodes.length && (
                <div className="table-empty">
                  <p>No nodes match your filters.</p>
                  <button className="button secondary" onClick={resetFilters}>
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
        <section className="quick-guide" aria-labelledby="guide-heading">
          <div className="guide-heading">
            <h2 id="guide-heading">A little context. A clearer map.</h2>
            <button className="text-button" onClick={() => setModal("help")}>
              Read the guide
              <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="guide-grid">
            <article>
              <span className="guide-icon">
                <Icon name="wallet" size={22} />
              </span>
              <div>
                <h3>Size tells a story</h3>
                <p>
                  Larger wallet bubbles hold more tokens. Use holding size to
                  find the balances that matter to you.
                </p>
              </div>
            </article>
            <article>
              <span className="guide-icon">
                <Icon name="network" size={22} />
              </span>
              <div>
                <h3>Follow the connections</h3>
                <p>
                  Select a bubble to inspect its neighbors. Solid arrows show
                  transfers; dashed lines show token holdings.
                </p>
              </div>
            </article>
            <article>
              <span className="guide-icon">
                <Icon name="token" size={22} />
              </span>
              <div>
                <h3>Bring your ecosystem</h3>
                <p>
                  Add your contracts and wallets to replace this preview with a
                  recent, read-only on-chain snapshot.
                </p>
              </div>
            </article>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <a href="#/" className="footer-brand">
          imd atlas<span>A view into the ecosystem.</span>
        </a>
        <span>Explore connections. Draw your own conclusions.</span>
        <button className="text-button" onClick={() => setModal("source")}>
          Data & methodology
          <Icon name="external" size={14} />
        </button>
      </footer>
      {modal === "setup" && (
        <Setup config={config} onClose={() => setModal(null)} onSave={save} />
      )}
      {modal === "help" && (
        <Modal title="Find your way around" onClose={() => setModal(null)}>
          <div className="help-content">
            <p>
              IMD Atlas maps wallets, token supply, and the connections between
              them.
            </p>
            <ol>
              <li>
                <strong>Start with your addresses.</strong> Add the IMD token
                contract, network, and public RPC. Include other ERC-20 tokens
                and wallets if you want to watch them.
              </li>
              <li>
                <strong>Narrow the map.</strong> Filter by wallet balance as a
                percentage of the IMD supply, search a full address, or select a
                cluster number. On a phone, open Filters.
              </li>
              <li>
                <strong>Inspect a bubble.</strong> Select it to see its balance
                and linked nodes. Choose Focus connections to isolate its
                neighborhood. Every node is also available in the explorer
                table.
              </li>
              <li>
                <strong>Move around.</strong> Drag the map to pan. Use the plus
                and minus controls to zoom, and the corner icon to reset the
                view. With the map focused, arrow keys pan and Home resets it.
              </li>
            </ol>
            <div className="guide-key">
              <span>
                <i className="key-circle" />
                Wallet · relative balance
              </span>
              <span>
                <i className="key-circle token-circle" />
                Token · remaining supply capacity
              </span>
              <span>
                <i className="line solid" />
                Arrow · direction of transfers
              </span>
              <span>
                <i className="line dashed" />
                Dashed line · a token holding
              </span>
            </div>
            <p className="help-note">
              A connection shows activity, not common ownership. Clusters are
              connected components of the observed graph. An isolated node may
              have connections outside the scanned range.
            </p>
          </div>
        </Modal>
      )}
      {modal === "source" && (
        <Modal title="Data & methodology" onClose={() => setModal(null)} wide>
          <div className="source-content">
            {preview ? (
              <div className="source-callout">
                <strong>This is an illustrative preview.</strong>
                <p>
                  All displayed values are examples for learning the controls.
                  No real contracts or wallets have been assigned to these
                  nodes.
                </p>
                <button
                  className="button primary"
                  onClick={() => setModal("setup")}
                >
                  Add your addresses
                  <Icon name="arrow" />
                </button>
              </div>
            ) : (
              <>
                <dl className="source-facts">
                  <div>
                    <dt>Network</dt>
                    <dd>
                      {config.chainName} · Chain {snapshot.chainId}
                    </dd>
                  </div>
                  <div>
                    <dt>IMD contract</dt>
                    <dd>
                      <code>{config.tokenAddress}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Public RPC</dt>
                    <dd>{config.rpcUrl}</dd>
                  </div>
                  <div>
                    <dt>Scan range</dt>
                    <dd>
                      {snapshot.fromBlock?.toLocaleString()} to{" "}
                      {snapshot.block?.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt>Block time</dt>
                    <dd>
                      {snapshot.blockTime
                        ? new Date(snapshot.blockTime).toLocaleString()
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt>Fetched</dt>
                    <dd>{new Date(snapshot.fetchedAt!).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Block hash</dt>
                    <dd>
                      <code>{snapshot.blockHash}</code>
                    </dd>
                  </div>
                </dl>
                {snapshot.notices.length > 0 && (
                  <ul className="source-notices">
                    {snapshot.notices.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <h3>What the map can tell you</h3>
            <p>
              Recent ERC-20 Transfer events discover wallets. Balances and token
              supply are read at one block, two blocks behind the reported head.
              Arrows aggregate positive transfers in each direction; mint and
              burn events are excluded from links.
            </p>
            <p>
              Up to 120 wallets are read, prioritizing your list and recent
              activity. The map keeps your tracked wallets and the largest
              balances within a limit of 80. It does not claim to rank every
              holder.
            </p>
            <p>
              Watched-token holdings cover up to 40 wallets. Token bubbles use
              remaining capacity from cap(), maxSupply(), or MAX_SUPPLY().
              Unknown capacity uses the minimum bubble size. A cap does not
              confirm mint permission or availability. Different tokens’ units
              cannot be compared.
            </p>
            <p>
              Snapshots refresh when you ask. A saved snapshot retains its
              original timestamp and may be stale. No wallet signatures or
              transactions are requested.
            </p>
            <div className="source-actions">
              <button
                className="button secondary"
                onClick={() => setModal("setup")}
              >
                Edit data settings
              </button>
              {configured && (
                <button
                  className="text-button"
                  onClick={() => setModal("reset")}
                >
                  Clear saved settings
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Clear saved settings?" onClose={() => setModal(null)}>
          <p className="modal-intro">
            This removes the addresses and snapshot saved in this browser and
            returns to the illustration. You will need to enter your addresses
            again.
          </p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Keep settings
            </button>
            <button
              className="button primary"
              onClick={() => {
                abort.current?.abort();
                clearSettings();
                setConfig(blankConfig);
                setSnapshot(illustration);
                setError("");
                setLoading(false);
                setStorageNote("");
                setIsCached(false);
                resetFilters();
                setModal(null);
              }}
            >
              Clear settings
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export default App;
