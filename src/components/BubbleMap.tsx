import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { MapNode, MapEdge } from "../types";
import { compactAmount, supplyShare } from "../model";
import { arrange } from "../map-layout";
import { Icon } from "./Icon";
export const palette = [
  { fill: "#f9d8c9", stroke: "#d56b45", ink: "#75361f", dot: "#c85d36" },
  { fill: "#e4ddf5", stroke: "#9b86c4", ink: "#59427e", dot: "#8a70b7" },
  { fill: "#d6eade", stroke: "#76ac8d", ink: "#315b40", dot: "#569270" },
  { fill: "#dce8f6", stroke: "#82a6cd", ink: "#3d5a7a", dot: "#6b94bf" },
  { fill: "#f1e6c7", stroke: "#b69a53", ink: "#685520", dot: "#a18640" },
];
export function BubbleMap({
  nodes,
  allNodes,
  edges,
  selected,
  onSelect,
  showTransfers,
  totalSupply,
  onResetFilters,
}: {
  nodes: MapNode[];
  allNodes: MapNode[];
  edges: MapEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  showTransfers: boolean;
  totalSupply: string;
  onResetFilters: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 475 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    if (wrap.current) observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [allNodes]);
  const positions = useMemo(
    () => arrange(allNodes, size.width, size.height),
    [allNodes, size],
  );
  const byId = useMemo(
    () => new Map(positions.map((p) => [p.node.id, p])),
    [positions],
  );
  const ids = new Set(nodes.map((n) => n.id));
  const related = new Set<string>(selected ? [selected] : []);
  edges.forEach((e) => {
    if (e.source === selected) related.add(e.target);
    if (e.target === selected) related.add(e.source);
  });
  const start = (event: PointerEvent<SVGSVGElement>) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest('[role="button"]')
    )
      return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      px: pan.x,
      py: pan.y,
      moved: false,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x,
      dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    setPan({ x: drag.current.px + dx, y: drag.current.py + dy });
  };
  const end = () => {
    if (drag.current && !drag.current.moved) onSelect(null);
    drag.current = null;
    setDragging(false);
  };
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  return (
    <div className={`map-canvas ${dragging ? "is-dragging" : ""}`} ref={wrap}>
      <svg
        className="bubble-svg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="group"
        tabIndex={0}
        aria-label="Interactive ecosystem bubble map"
        aria-describedby="map-keyboard-help"
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [30, 0],
            ArrowRight: [-30, 0],
            ArrowUp: [0, 30],
            ArrowDown: [0, -30],
          };
          if (moves[event.key]) {
            event.preventDefault();
            const [x, y] = moves[event.key];
            setPan((p) => ({ x: p.x + x, y: p.y + y }));
          }
          if (event.key === "Home") {
            event.preventDefault();
            reset();
          }
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        <defs>
          <pattern
            id="map-grid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.75" fill="#dce0e5" />
          </pattern>
          <marker
            id="flow-arrow"
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="m1 1 5 3-5 3"
              fill="none"
              stroke="#8d959e"
              strokeWidth="1.2"
            />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-grid)" />
        <g
          transform={`translate(${size.width / 2 + pan.x} ${size.height / 2 + pan.y}) scale(${zoom}) translate(${-size.width / 2} ${-size.height / 2})`}
        >
          {showTransfers &&
            edges.map((edge) => {
              const a = byId.get(edge.source),
                b = byId.get(edge.target);
              if (!a || !b) return null;
              const dx = b.x - a.x,
                dy = b.y - a.y,
                d = Math.hypot(dx, dy) || 1;
              const highlighted =
                !selected ||
                edge.source === selected ||
                edge.target === selected;
              return (
                <path
                  key={edge.id}
                  d={`M${a.x + (dx / d) * (a.r + 2)},${a.y + (dy / d) * (a.r + 2)} L${b.x - (dx / d) * (b.r + 6)},${b.y - (dy / d) * (b.r + 6)}`}
                  stroke={highlighted ? "#9ca4ad" : "#d5d9df"}
                  strokeWidth={selected && highlighted ? 1.8 : 1.1}
                  strokeDasharray={edge.kind === "holding" ? "4 5" : undefined}
                  markerEnd={
                    edge.kind === "transfer" ? "url(#flow-arrow)" : undefined
                  }
                  opacity={highlighted ? 0.8 : 0.3}
                >
                  <title>
                    {edge.kind === "transfer"
                      ? `${edge.count} transfers from ${a.node.label} to ${b.node.label}`
                      : `${a.node.label} holds ${b.node.label}`}
                  </title>
                </path>
              );
            })}
          {positions
            .filter((p) => ids.has(p.node.id))
            .map(({ node, x, y, r }) => {
              const colors = palette[node.cluster % palette.length];
              const isSelected = node.id === selected;
              const dimmed = !!selected && !related.has(node.id);
              return (
                <g
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect ${node.label}, ${node.kind === "wallet" ? `${supplyShare(node.amount, totalSupply)} of supply` : node.cap ? `${compactAmount(node.amount, node.decimals)} remaining capacity` : "capacity unknown"}`}
                  aria-pressed={isSelected}
                  className={`bubble-node ${isSelected ? "selected-node" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(node.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node.id);
                    }
                  }}
                  transform={`translate(${x} ${y})`}
                  opacity={dimmed ? 0.28 : 1}
                >
                  <title>
                    {node.label}
                    {node.address ? ` · ${node.address}` : ""}
                  </title>
                  <circle r={Math.max(r, 12)} fill="transparent" />
                  <circle
                    r={r + 5}
                    className="node-focus"
                    fill="none"
                    stroke="#252a35"
                    strokeWidth={isSelected ? 1.5 : 0}
                    strokeDasharray="3 3"
                  />
                  <circle
                    className="node-body"
                    r={r}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={isSelected ? 2.2 : 1.4}
                    strokeDasharray={node.kind === "token" ? "4 3" : undefined}
                  />
                  {node.kind === "token" && (
                    <circle
                      r={Math.max(0, r - 5)}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth="0.6"
                    />
                  )}
                  {r >= 25 && (
                    <>
                      <text
                        y={r >= 41 ? -4 : 4}
                        textAnchor="middle"
                        fill={colors.ink}
                        className="node-label"
                      >
                        {node.kind === "wallet"
                          ? supplyShare(node.amount, totalSupply)
                          : node.label.length > 11
                            ? "Token"
                            : node.label}
                      </text>
                      {r >= 41 && (
                        <text
                          y="16"
                          textAnchor="middle"
                          fill={colors.ink}
                          className="node-caption"
                        >
                          {node.kind === "wallet" ? node.label : "capacity"}
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
      <span className="sr-only" id="map-keyboard-help">
        Use arrow keys to pan and Home to reset the map. Use Tab to reach a
        bubble, then Enter to inspect it.
      </span>
      {!nodes.length && (
        <div className="map-empty">
          <Icon name="search" size={28} />
          <h3>{allNodes.length ? "No matching nodes" : "No wallets found"}</h3>
          <p>
            {allNodes.length
              ? "Try a smaller holding size or clear your filters."
              : "Add wallet addresses or choose a wider block range in Edit addresses."}
          </p>
          {allNodes.length > 0 && (
            <button className="button secondary" onClick={onResetFilters}>
              Reset filters
            </button>
          )}
        </div>
      )}
      <div className="map-hint">
        <Icon name="info" size={14} />
        <span>Select a bubble to explore</span>
      </div>
      <div className="zoom-controls">
        <button
          className="icon-button"
          aria-label="Zoom out"
          disabled={zoom <= 0.65}
          onClick={() => setZoom((z) => Math.max(0.65, z - 0.2))}
        >
          <Icon name="minus" />
        </button>
        <output aria-label="Map zoom">{Math.round(zoom * 100)}%</output>
        <button
          className="icon-button"
          aria-label="Zoom in"
          disabled={zoom >= 2.4}
          onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}
        >
          <Icon name="plus" />
        </button>
        <span className="control-divider" />
        <button
          className="icon-button"
          aria-label="Reset map view"
          onClick={reset}
        >
          <Icon name="expand" />
        </button>
      </div>
    </div>
  );
}
