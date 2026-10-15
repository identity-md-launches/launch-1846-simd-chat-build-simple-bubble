# IMD Atlas

A static, read-only explorer for IMD holders, watched token supply and wallet connections. The home page and data explorer share an interactive SVG bubble map with search, holding-size and relationship filters, cluster selection, node details, pan/zoom, and CSV export.

**The default map is explicitly illustrative.** No IMD contracts or wallets were supplied with the assignment. Configure real addresses through **Add addresses**, or set deployment defaults in `public/ecosystem.json`. No guessed addresses, wallet keys, backend or wallet connection are included.

## Preview the delivered site

`dist/` is the complete production export, including its font, share image, favicon and configuration. Serve it over HTTP:

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Home is `#/`; the explorer is `#/explorer`. The site also works beneath a static hosting subpath. Vite uses `base: './'`; generated asset URLs are relative. No server-side rewrite is required. Opening HTML through `file://` is not supported because modules and configuration use HTTP requests.

## Install and rebuild

Requirements: Node.js 22.12+ (Node 24.21.0 was used), npm, and Python 3 for the optional staging helper. Exact application/build dependencies are pinned in `package-lock.json`.

The following workflow keeps dependencies and caches outside the repository, so generated directories cannot enter the submission:

```sh
BUILD_DIR="$(mktemp -d /tmp/imd-atlas-build.XXXXXX)"
python3 scripts/sync-build.py "$BUILD_DIR"
npm ci --prefix "$BUILD_DIR" --cache "$BUILD_DIR/npm-cache" --no-audit --no-fund
npm --prefix "$BUILD_DIR" run typecheck
npm --prefix "$BUILD_DIR" test
npm --prefix "$BUILD_DIR" run build
```

Copy the completed export back to the repository, replacing the previous generated export:

```sh
python3 - "$BUILD_DIR" <<'PY'
import shutil
import sys
from pathlib import Path
source = Path(sys.argv[1]) / 'dist'
assert (source / 'index.html').is_file()
shutil.rmtree('dist', ignore_errors=True)
shutil.copytree(source, 'dist')
PY
```

After changing source, run `python3 scripts/sync-build.py "$BUILD_DIR"` again before building. For development, run `npm --prefix "$BUILD_DIR" run dev` after staging. For Vite's production preview, run `npm --prefix "$BUILD_DIR" run preview`.

Source, package manifests, lockfile and the complete `dist/` belong in the deliverable. Dependencies, package-manager caches, browser profiles, package archives and `test/scratch/` do not. No ignore file was changed; all installed tooling and dependencies were kept outside the repository.

## Configure the ecosystem

In **Add addresses**, enter:

1. Network name and numeric chain ID.
2. A public HTTPS JSON-RPC endpoint that allows browser requests (CORS). Do not enter a private API key.
3. The IMD ERC-20 token contract address.
4. Optional mintable-token contracts (up to 8) and wallets to include (up to 40).
5. A recent block window: 100, 500, 2,000 or 10,000 blocks.

All network/address fields in `public/ecosystem.json` intentionally start empty. Set `chainId`, `chainName`, `rpcUrl`, `tokenAddress`, `mintableTokens`, `wallets` and `blockWindow` to publish owner-selected defaults, then rebuild. A visitor's saved valid settings take precedence. Defaults populate the setup flow; a visitor starts reads with **Load data**. Browser-entered settings and the last successful snapshot stay in local storage. They are not shared between visitors. **Data & methodology → Clear saved settings** removes both after confirmation.

The deployed export contains no machine-specific RPC endpoints. The browser sends read-only RPC requests to the endpoint its operator or visitor supplies. It never requests wallet access, signs or sends transactions.

## Read the map

- **All nodes / Wallets / Tokens** chooses the category. Search accepts a node label, token symbol or full wallet/contract address.
- **Holding size** filters wallets by their share of the primary token’s total supply. It does not compare amounts across different tokens.
- **Relationships** selects connected or isolated nodes. Inspect a node and use **Focus connections** to see its direct neighbors.
- Cluster numbers filter connected components. A connection does not establish common ownership.
- Solid arrows aggregate positive transfers in their direction. Dashed links show watched-token holdings. Turning connections off only changes their visibility.
- Select a bubble or table row for full address, exact values and linked nodes. Drag to pan; use zoom buttons or focus the map and use arrow keys. Home resets the view.
- On phones, open **Filters** for search, holding size, relationships and the connection switch.
- **Export CSV** downloads the current filtered nodes. It includes provenance, precise decimal amounts, snapshot block and unknown/error values. It does not export a complete transaction ledger.

## Data scope and limits

The reader validates the RPC chain ID and scans ERC-20 `Transfer` events in bounded chunks. It reads balances, decimals and total supply at one block, two blocks behind the head, then rechecks the block hash. This reduces inconsistencies but is not a finality guarantee.

Up to 120 candidate wallets are read, with supplied wallets and recent activity prioritized. The graph retains supplied wallets and the largest observed balances, up to 80 wallets. It is **not an exhaustive top-holder index**: inactive holders outside the window may be absent. Mint/burn addresses and zero-amount/self transfers are excluded from transfer links. If the RPC refuses a range, the reader splits it; over 12,000 events requires a smaller window. Reads have per-request and overall timeouts and can be cancelled.

For each supplied ERC-20 token, the app attempts `cap()`, `maxSupply()` and `MAX_SUPPLY()`. When a consistent cap is readable, remaining capacity is `cap − totalSupply`. Otherwise capacity is **Unknown** and its bubble uses the minimum size. This does not prove public minting is enabled, nor account for contract-specific permissions, phases or fees. NFT standards and arbitrary mint ABIs are not implemented. Holding links cover at most 40 wallets per watched token. Small positive amounts retain their exact values in details and exports.

Wallet balances that fail to load are omitted rather than set to zero. Partial coverage has a visible note; details list the limits. Saved snapshots retain their original timestamp and may be stale. Refresh is manual. Unsupported contracts, network mismatches and provider failures show actionable errors without presenting the illustration as live data.

## Validation

Final commands were run after the last source changes:

- `npm run typecheck`: passed.
- `npm test`: **41 tests passed**, including dense-map geometry through 88 nodes, tiny-share thresholds, precision, filter intersections, graph components, checksum validation, RPC failures, range splitting, block consistency, dual-role contract nodes and cache corruption.
- `npm run build`: passed; the resulting export is in `dist/`.
- `scripts/validate-browser.mjs`: **18 groups passed**: Chromium interaction, responsive and accessibility checks, using the production export under `/preview/`. See `artifacts/interaction-report.json` for the final results.
- `scripts/validate-revision.mjs`: passed the four review reproductions. All **243 center clicks** selected the intended node across 320/390/1440px; no overlapping circles or center-hit misses. Tiny shares, CSV, empty saved snapshots, recovery through Edit addresses, and both pages’ guide headings passed. Before/after results are in `artifacts/revision-before.json` and `artifacts/revision-after.json`.
- Pinned `taste.mjs`: design probe at 320, 390 and 1440px, including reduced motion. **16/16 passed**. Final results are in `artifacts/design-probe.json` and `artifacts/validation.md`.

The browser runner uses controlled RPC responses for loading, wrong-network, success, cache and cancellation scenarios. These are test fixtures, not verification of actual IMD contracts. No actual IMD balance scan was possible without supplied contracts. WebKit was attempted but could not launch due to missing system libraries. No physical-device or manual screen-reader session was performed.

To rerun the optional browser checks with tooling outside the repository:

```sh
CHECK_DIR="$(mktemp -d /tmp/imd-atlas-checks.XXXXXX)"
npm install --prefix "$CHECK_DIR" --cache "$CHECK_DIR/npm-cache" --no-audit --no-fund playwright@1 @axe-core/playwright
export PLAYWRIGHT_BROWSERS_PATH="$CHECK_DIR/browsers"
"$CHECK_DIR/node_modules/.bin/playwright" install chromium webkit
export IMD_PLAYWRIGHT="$CHECK_DIR/node_modules/playwright/index.mjs"
node scripts/validate-browser.mjs
node scripts/validate-revision.mjs
```

The runner starts and closes its own bounded preview server. Reports and screenshots go to `test/scratch/interaction/` and `test/scratch/revision/`. The revision runner intercepts its `.invalid` RPC fixture locally; it never sends that fixture to a real chain. Use `--baseline` to observe the old behavior without asserting the fixes. Selected final reports and screenshots are copied to `artifacts/` for review. Browser system libraries must be installed by the environment. Native zoom uses a temporary Chromium test extension and profile outside the repository. When the assignment's pinned probe is present, run:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The pinned inputs are not part of the delivered application. They are not required to install or build it. The share image is already bundled; optional regeneration uses `node scripts/create-share.mjs` with the same external Playwright setup.

## Files and references

- `src/App.tsx`: pages, shared filters, state and read orchestration.
- `src/components/`: map, inspector, setup and accessible native dialog.
- `src/map-layout.ts`: area-aware radius scaling, collision settling and dense-map fallback.
- `src/rpc.ts`: bounded on-chain reader.
- `src/model.ts`: exact units, filters, graph components, validation and CSV.
- `src/storage.ts`: configuration and snapshot cache.
- `src/illustration.ts`: explicitly labeled diagram-only values, without real addresses.
- `public/`: owner-settable defaults, local font, favicon and share image.
- `DESIGN.md`: implemented visual tokens, components and responsive behavior.
- `artifacts/validation.md`: review coverage, repaired findings, evidence and limitations.
- `artifacts/licenses/` and `public/fonts/LICENSE.txt`: retained third-party notices.

Implementation references: [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/), [ERC-20](https://eips.ethereum.org/EIPS/eip-20), [ERC-55 checksum specification and test vectors](https://eips.ethereum.org/EIPS/eip-55), and [Vite static production builds](https://vite.dev/guide/build.html). The checksum addresses in tests are published standard test vectors; none is used as deployment configuration.
