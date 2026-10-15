# IMD Atlas design system

## Overview

IMD Atlas is a read-only visual explorer for the IMD ecosystem. It pairs a large, interactive bubble map with holder rankings and a searchable data table. The visual idea is a calm research canvas: connected circles sit on a pale dot grid, with a restrained orange accent for the main action.

The two hash-routed pages share the header, map, filters, node inspector, setup dialog and short guide. Overview uses “Explore the IMD ecosystem” with the existing orange title emphasis. The shared guide uses task headings (“How to use the map”, “Filter by holding size”). Overview introduces the map; Data explorer adds the complete filtered table and CSV export. The default diagram is explicitly illustrative. On-chain and saved snapshots have distinct source labels and timestamps.

Source of truth: `src/styles.css` for shared tokens/layout; `src/map-layout.ts` for chart geometry and `src/components/BubbleMap.tsx` for category colors; `src/App.tsx` for page composition.

## Colors

The implemented palette uses semantic CSS properties rather than a generated color ramp. Only the light theme is implemented.

| Token | Value | Role |
| --- | --- | --- |
| `--page` | `#f6f7f9` | Page background |
| `--surface` | `#ffffff` | Map, controls, dialogs and data table |
| `--surface-soft` | `#f9fafb` | Filter strip and inset guide content |
| `--text` | `#242832` | Primary text and active navigation |
| `--muted` | `#666d79` | Descriptions, labels and metadata |
| `--faint` | `#6b7280` | Input placeholder text |
| `--line` | `#e5e7eb` | Structural dividers |
| `--line-strong` | `#c7ccd3` | Input and secondary-button outlines |
| `--accent` | `#bc421c` | Primary action and headline detail |
| `--accent-hover` | `#a43716` | Primary action hover |
| `--accent-soft` | `#fbeee8` | Selected data row |
| `--positive` | `#357351` | On-chain / saved snapshot label |
| `--danger` | `#b22f2f` | Field and read errors |
| `--focus` | `#254eaa` | Keyboard focus ring |

The exported `palette` in `BubbleMap.tsx` defines five cluster styles:

| Cluster style | Fill | Stroke | Text | Legend dot |
| --- | --- | --- | --- | --- |
| Orange | `#f9d8c9` | `#d56b45` | `#75361f` | `#c85d36` |
| Lavender | `#e4ddf5` | `#9b86c4` | `#59427e` | `#8a70b7` |
| Green | `#d6eade` | `#76ac8d` | `#315b40` | `#569270` |
| Blue | `#dce8f6` | `#82a6cd` | `#3d5a7a` | `#6b94bf` |
| Ochre | `#f1e6c7` | `#b69a53` | `#685520` | `#a18640` |

Colors repeat after five clusters; cluster numbers distinguish every group. A solid outline identifies wallets. A dashed outer ring and inner ring identify tokens. Transfer arrows and dashed holding lines remain distinct without color. Color is not evidence of common wallet ownership.

Measured rendered contrast on the final palette: primary text/page **13.75:1**, secondary text/page **4.86:1**, white text/primary button **5.34:1**. See `artifacts/validation.md` for coverage and limits.

## Typography

Inter Variable is bundled in `public/fonts/InterVariable.woff2` with its SIL Open Font License. The CSS stack is Inter, Apple system, BlinkMacSystemFont, Segoe UI, sans-serif. The file supports weights 100–900; the interface uses **400 and 600**. System monospace is reserved for complete addresses and exact numeric values. Font synthesis is disabled, and `font-display: swap` is used.

There are six named type sizes in `src/styles.css`:

| Token | Size | Use |
| --- | --- | --- |
| `--text-xs` | 12px | Dense metadata, chart captions, desktop filters |
| `--text-sm` | 14px | Body UI, buttons, form labels |
| `--text-base` | 16px | Intro text, smaller headings, mobile inputs |
| `--text-lg` | 20px | Section headings and wordmark suffix |
| `--text-xl` | 32px | Summary numbers and compact page title |
| `--text-display` | 48px | Desktop page title |

Body line-height is 1.5; instructions and notes use 1.6–1.75. The title uses 1.15 and −0.045em tracking. Section headings use 1.3 and −0.025em. Small text has normal tracking. Headings use balanced wrapping; descriptions use pretty wrapping. Changing numbers use tabular numerals. Complete addresses and exact amounts wrap anywhere in the inspector; compact addresses in rankings always lead to that inspector.

## Layout

The desktop page and header have a 1512px maximum width with 52px side padding. The map is the primary surface, with a 298px rankings/inspector column. Filters precede the map. The SVG keeps stable positions when a filter changes; its layout is recomputed only for a new snapshot or canvas size. Packing reserves 40px above and 60px below the nodes for the hint and zoom controls, with 12px side insets. A common radius scale derives from total bubble area and the usable rectangle. Cluster attraction stops before collision settling; only a verified fit is rendered. Dense layouts that cannot settle use a bounded grid with a common radius scale. The supported maximum is 80 wallets plus 8 token nodes; minimum 24px hit areas remain separate at initial fit.

Spacing is primarily 4, 8, 12, 16, 20, 24, 28, 32, 40 and 52px. Smaller gaps join labels and their values; larger gaps separate sections. Layout is expressed with grid, flex and predominantly logical properties.

Implemented breakpoints:

- **1180px:** side padding becomes 32px, the page title becomes 32px, metric captions wrap, the inspector becomes 280px, and visible filter labels become visually hidden while retaining accessible names.
- **900px:** the inspector stacks below the map; the holder list uses two columns; the three-column guide becomes one column.
- **680px:** navigation occupies a second header row; side padding becomes 20px; the action sits below the title; summary counts move below the map. Filters are disclosed by a Filters button. The map is 320px high. Dialog inputs are 16px. Rankings use one column. The explorer table retains node, balance/capacity and details columns; the inspector exposes the complete data.
- **360px:** side padding becomes 14px; the wordmark suffix and redundant map count are removed to preserve controls.

The graph has its own pan/zoom viewport; the document itself does not require horizontal scrolling. Tested widths are 320, 390, 768 and 1440 CSS pixels. At 390×844, the main action and complete default map canvas fit on the first screen. Native Chromium 200% zoom was also checked. English is the only implemented language; RTL and localization variants are not supplied.

## Elevation & Depth

The interface is flat: thin borders separate map regions, table rows and inputs. Ordinary surfaces have no shadow. The native dialog uses a single `0 24px 80px #141c3433` shadow without a border, with a `#171e3266` backdrop and 3px backdrop blur. Dialogs use the browser top layer instead of application z-index stacks.

## Shapes

Main surfaces use `--radius: 12px`; buttons use 7px, text fields 6px, segmented controls 7px with 4px segments. Desktop dialogs use 16px, narrowing to 12px on phones. Graph nodes are circles. Token rings distinguish their type. The SVG includes transparent hit circles of at least 24px diameter at default zoom, and its packing includes those hit areas.

## Components

| Component / pattern | Source | Behavior |
| --- | --- | --- |
| Header and hash navigation | `src/App.tsx` | Brand returns home, active link has a line and weight change. Skip link focuses main without changing the route. |
| Buttons | `src/styles.css` `.button`, `.primary`, `.secondary`, `.icon-button`, `.text-button` | Primary filled orange; secondary outlined; icon buttons have accessible names. Hover, press, disabled and focus states are explicit. |
| `BubbleMap` | `src/components/BubbleMap.tsx` | Receives filtered nodes/edges plus all nodes for stable placement. Supports pointer pan, arrow-key pan, Home reset, button zoom, and Enter/Space node inspection. Filtered-out results offer Reset filters. An empty snapshot instead says “No wallets found” and directs visitors to Edit addresses or a wider block range. |
| Filter strip | `src/App.tsx` | Node type, query, share threshold, relationship and cluster filters intersect. Connection visibility does not change the underlying graph or relationship counts. Mobile filters expose the same controls. |
| `NodePanel` | `src/components/NodePanel.tsx` | Ranking tabs support Left/Right/Home/End. Selected nodes expose full address, balance/capacity, exact values, connections and neighborhood focus. Copy success/failure is announced. |
| `Modal` | `src/components/Modal.tsx` | Native dialog provides modal focus containment; Escape, close control and backdrop dismiss it. Focus returns to its trigger. Long forms scroll within the dialog. |
| `Setup` | `src/components/Setup.tsx` | Labeled fields, validation on submit, field-specific errors, first-invalid-field focus. No wallet connection or signature. |
| Source and read states | `src/App.tsx` | Illustration, loading/progress/cancel, on-chain snapshot, cached snapshot, partial coverage and retryable error states are distinct. Unknown values are never presented as known zero values. Positive supply shares below 0.01% display “<0.01%” from the original integer amounts, including in CSV; zero balances display “0%”. |
| Explorer table | `src/App.tsx` | Uses the same filtered nodes as the map; every row opens the inspector. CSV exports this filtered set with exact values and data provenance. |

Interactive transitions are 150ms, using `cubic-bezier(0.2, 0, 0, 1)` or an opacity ease-out. Pressed action controls scale to 0.96. Only the busy refresh icon loops. Motion is enclosed in `prefers-reduced-motion: no-preference`; reduced motion has no ongoing animation. There is no automatic map drift or entrance animation.

Keyboard focus uses a 2px outline with 4px offset, with a separate SVG node focus ring and forced-colors fallback. Most primary controls are at least 44px high. Dense map tools and legend controls use smaller, spaced targets; every node is also reachable from the explorer table.

## Do's and Don'ts

- Reuse the shared page frame, semantic color tokens and six-size type scale for another page.
- Keep filter controls above the data they affect, and keep the same filtered set in the map, table and export.
- Keep raw addresses and precise amounts available in details; do not replace those values with display rounding.
- Preserve the illustration/snapshot distinction and the observed-holder scope in new summaries.
- Treat token capacity as a read result, not proof that minting is open. Do not compare unrelated token units as financial value.
- Do not add continuous decorative motion, another font, a shadow on bordered cards, or a wallet-connect flow to this read-only tool.

A new page should use the existing header/hash navigation, one page title in `.page-intro`, the established control classes, and a primary data surface. Apply the 680px layout pattern and verify its main action at 390px.

Design guidance: Jakub Krehel’s Better Interface, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT). Documentation method: Paul Bakaus’s Impeccable, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0). Notices and licenses are retained in `artifacts/licenses/design-guidance.txt`.
