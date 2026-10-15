import type { MapNode } from "./types";

interface Position {
  node: MapNode;
  x: number;
  y: number;
  r: number;
  ax: number;
  ay: number;
}
export function arrange(nodes: MapNode[], width: number, height: number): Position[] {
  if (!nodes.length) return [];
  // Keep the hint and zoom controls outside the packing rectangle at initial fit.
  const bounds = { left: 12, top: 40, right: width - 12, bottom: height - 60 };
  const usableWidth = bounds.right - bounds.left;
  const usableHeight = bounds.bottom - bounds.top;
  const scale = Math.min(1, width / 740);
  const maximum = (kind: MapNode["kind"]) =>
    nodes
      .filter((n) => n.kind === kind)
      .reduce((max, n) => {
        const amount = Number(n.amount) / 10 ** n.decimals;
        return Math.max(max, amount);
      }, 1);
  const maxima = { wallet: maximum("wallet"), token: maximum("token") };
  const clusters = [
    ...new Set(nodes.filter((n) => n.kind === "wallet").map((n) => n.cluster)),
  ];
  const count = clusters.length;
  const anchors = [
    [0.48, 0.47],
    [0.21, 0.29],
    [0.76, 0.72],
    [0.79, 0.27],
  ];
  const ordered = [...nodes].sort(
    (a, b) =>
      Number(b.kind === "wallet") - Number(a.kind === "wallet") ||
      Number(b.amount) / 10 ** b.decimals - Number(a.amount) / 10 ** a.decimals,
  );
  const clusterIndexes = new Map<number, number>();
  let tokenIndex = 0;
  const tokenCount = nodes.filter((n) => n.kind === "token").length;
  const positions = ordered.map((node) => {
    const i = clusterIndexes.get(node.cluster) || 0;
    const c = clusters.indexOf(node.cluster);
    const r = Math.max(
      9,
      (15 +
        48 *
          Math.sqrt(
            Number(node.amount) / 10 ** node.decimals / maxima[node.kind],
          )) *
        scale,
    );
    let ax: number, ay: number, x: number, y: number;
    if (node.kind === "token") {
      ax = bounds.left + usableWidth * (0.22 + 0.56 * (++tokenIndex / (tokenCount + 1)));
      ay = bounds.top + usableHeight * 0.85;
      x = ax;
      y = ay;
    } else {
      if (count <= 4) {
        ax = bounds.left + usableWidth * anchors[Math.max(0, c)][0];
        ay = bounds.top + usableHeight * anchors[Math.max(0, c)][1];
      } else {
        const columns = Math.ceil(Math.sqrt((count * width) / height));
        ax = bounds.left + (((c % columns) + 0.5) * usableWidth) / columns;
        ay =
          bounds.top + ((Math.floor(c / columns) + 0.5) * usableHeight) /
          Math.ceil(count / columns);
      }
      const theta = i * 2.399963;
      const radius = i === 0 ? 0 : (67 + i * 12) * scale;
      x = ax + Math.cos(theta) * radius;
      y = ay + Math.sin(theta) * radius;
      clusterIndexes.set(node.cluster, i + 1);
    }
    return { node, r, ax, ay, x, y };
  });
  const radii = positions.map((p) => p.r);
  const area = radii.reduce((sum, r) => sum + Math.PI * Math.max(r, 12) ** 2, 0);
  const radiusScale = Math.min(1, Math.sqrt((usableWidth * usableHeight * 0.48) / area));
  const hitRadius = (p: Position) => Math.max(p.r, 12);
  const gap = Math.max(2, 6 * scale);
  const fits = () => positions.every((a, i) => {
    const r = hitRadius(a);
    return a.x - r >= bounds.left - 0.01 && a.x + r <= bounds.right + 0.01 &&
      a.y - r >= bounds.top - 0.01 && a.y + r <= bounds.bottom + 0.01 &&
      positions.slice(i + 1).every((b) =>
        Math.hypot(a.x - b.x, a.y - b.y) >= r + hitRadius(b) + gap - 0.01,
      );
  });
  // Cluster attraction stops before collision settling. Bounds participate in each
  // iteration; an unresolved layout is never returned after a final clamp.
  for (let attempt = 0; attempt < 4; attempt++) {
    positions.forEach((p, i) => { p.r = Math.max(9, radii[i] * radiusScale * 0.9 ** attempt); });
    for (let step = 0; step < 300; step++) {
      for (const a of positions) {
        if (step < 100) {
          a.x += (a.ax - a.x) * 0.006;
          a.y += (a.ay - a.y) * 0.006;
        }
        const r = hitRadius(a);
        a.x = Math.max(bounds.left + r, Math.min(bounds.right - r, a.x));
        a.y = Math.max(bounds.top + r, Math.min(bounds.bottom - r, a.y));
      }
      for (let i = 0; i < positions.length; i++) {
        const a = positions[i];
        for (let j = i + 1; j < positions.length; j++) {
          const b = positions[j];
          const dx = b.x - a.x || 0.1, dy = b.y - a.y || 0.1;
          const distance = Math.hypot(dx, dy);
          const min = hitRadius(a) + hitRadius(b) + gap;
          if (distance < min) {
            const push = ((min - distance) / distance) * 0.5;
            a.x -= dx * push;
            a.y -= dy * push;
            b.x += dx * push;
            b.y += dy * push;
          }
        }
      }
      if (step >= 100 && fits()) return positions;
    }
  }
  // Extremely dense views may not settle around their cluster anchors. A bounded
  // grid provides a deterministic fit, including every 24px hit area, instead of
  // returning overlapping circles. Keep one common scale for the visible radii.
  let columns = 1, cellSize = 0;
  for (let c = 1; c <= nodes.length; c++) {
    const size = Math.min(usableWidth / c, usableHeight / Math.ceil(nodes.length / c));
    if (size > cellSize) { columns = c; cellSize = size; }
  }
  const rows = Math.ceil(nodes.length / columns);
  const fitScale = Math.min(radiusScale, (cellSize / 2 - 1) / Math.max(...radii));
  positions.forEach((p, i) => {
    p.r = Math.max(9, radii[i] * fitScale);
    p.x = bounds.left + ((i % columns) + 0.5) * usableWidth / columns;
    p.y = bounds.top + (Math.floor(i / columns) + 0.5) * usableHeight / rows;
  });
  return positions;
}
