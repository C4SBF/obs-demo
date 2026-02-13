import { useMemo, useEffect, useState } from "react";
import type { Entity, NodePosition } from "../types";
import { getRelationColor } from "../lib/utils";

interface Props {
  entities: Entity[];
  positions: Record<string, NodePosition>;
  nodeSizes: Record<string, { w: number; h: number }>;
  selectedId: string | null;
  miniMode?: boolean;
  visibleIds?: Set<string> | null;
}

const DEFAULT_W = 240;
const DEFAULT_H = 100;
const ARROW_MARGIN = 0;
const EDGE_SPREAD = 30;

/** Canonical key for a node pair (order-independent) */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}


interface EdgePath {
  d: string;
  color: string;
  type: string;
  labelX: number;
  labelY: number;
  source: string;
  target: string;
  highlighted: boolean;
}

// Track drawn paths outside the component to persist across renders
const globalDrawnPaths = new Set<string>();

export function Connections({ entities, positions, nodeSizes, selectedId, miniMode, visibleIds }: Props) {
  // State to track new path indices for animation
  const [newPathIndices, setNewPathIndices] = useState<Set<number>>(new Set());

  const paths = useMemo(() => {
    // Collect edges — one arrow per node pair (skip reverse)
    const seenPairs = new Set<string>();
    const edges: {
      source: string;
      target: string;
      relType: string;
      color: string;
    }[] = [];

    entities.forEach((entity) => {
      if (!positions[entity.id]) return;
      (entity.relationships || []).forEach((rel) => {
        if (!positions[rel.target]) return;
        if (visibleIds && !visibleIds.has(entity.id) && !visibleIds.has(rel.target)) return;
        const pk = pairKey(entity.id, rel.target);
        if (seenPairs.has(pk)) return;
        seenPairs.add(pk);
        const relType = rel.type || "related";
        edges.push({
          source: entity.id,
          target: rel.target,
          relType,
          color: getRelationColor(relType),
        });
      });
    });

    // Group edges by node pair for parallel offset
    const pairCounts = new Map<string, number>();
    const pairIndex = new Map<string, number>();
    edges.forEach((e) => {
      const key = pairKey(e.source, e.target);
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    });

    const result: EdgePath[] = [];

    edges.forEach((edge) => {
      const sp = positions[edge.source];
      const tp = positions[edge.target];
      const ss = nodeSizes[edge.source] || { w: DEFAULT_W, h: DEFAULT_H };
      const ts = nodeSizes[edge.target] || { w: DEFAULT_W, h: DEFAULT_H };

      const sCx = sp.x + ss.w / 2, sCy = sp.y + ss.h / 2;
      const tCx = tp.x + ts.w / 2, tCy = tp.y + ts.h / 2;
      const dx = tCx - sCx;
      const dy = tCy - sCy;

      const key = pairKey(edge.source, edge.target);
      const count = pairCounts.get(key) || 1;
      const idx = pairIndex.get(key) || 0;
      pairIndex.set(key, idx + 1);

      // Distribute multiple edges
      const spread = count > 1 ? (idx - (count - 1) / 2) * EDGE_SPREAD : 0;

      // Calculate start/end points on the bounding box
      // We want the arrow to start/end at the edge of the card, not the center
      const angle = Math.atan2(dy, dx);
      const eps = 0.001;

      // Start point (source)
      // Check intersection with source box
      // Box is [-w/2, w/2] x [-h/2, h/2] relative to center
      let sx, sy;
      // if |tan| > h/w, intersect top/bottom
      if (Math.abs(Math.tan(angle)) > (ss.h / ss.w)) {
        // Vertical intersection
        const sign = Math.sign(Math.sin(angle)) || 1;
        sy = sCy + sign * (ss.h / 2);
        sx = sCx + sign * (ss.h / 2) / Math.tan(angle + (Math.abs(Math.cos(angle)) < eps ? eps : 0));
        // Clamp x to box width
        sx = Math.max(sp.x, Math.min(sp.x + ss.w, sx));
      } else {
        // Horizontal intersection
        const sign = Math.sign(Math.cos(angle)) || 1;
        sx = sCx + sign * (ss.w / 2);
        sy = sCy + sign * (ss.w / 2) * Math.tan(angle);
        // Clamp y to box height
        sy = Math.max(sp.y, Math.min(sp.y + ss.h, sy));
      }
      // Apply perpendicular spread
      sx -= spread * Math.sin(angle);
      sy += spread * Math.cos(angle);

      // End point (target)
      let ex, ey;
      if (Math.abs(Math.tan(angle)) > (ts.h / ts.w)) {
        // Vertical
        if (Math.sin(angle) > 0) { // coming from top, hitting top edge
          ey = tp.y;
          ex = tCx - (ts.h / 2) / Math.tan(angle);
        } else { // coming from bottom, hitting bottom edge
          ey = tp.y + ts.h;
          ex = tCx + (ts.h / 2) / Math.tan(angle);
        }
        ex = Math.max(tp.x, Math.min(tp.x + ts.w, ex));
      } else {
        // Horizontal
        if (Math.cos(angle) > 0) { // hitting left edge
          ex = tp.x;
          ey = tCy - (ts.w / 2) * Math.tan(angle);
        } else { // hitting right edge
          ex = tp.x + ts.w;
          ey = tCy + (ts.w / 2) * Math.tan(angle);
        }
        ey = Math.max(tp.y, Math.min(tp.y + ts.h, ey));
      }
      ex -= spread * Math.sin(angle);
      ey += spread * Math.cos(angle);

      // Pull end back for arrowhead
      const edx = ex - sx, edy = ey - sy;
      const len = Math.sqrt(edx * edx + edy * edy);
      if (len > ARROW_MARGIN * 2) {
        const nx = edx / len, ny = edy / len;
        ex -= nx * ARROW_MARGIN;
        ey -= ny * ARROW_MARGIN;
      }

      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const isVert = Math.abs(dy) > Math.abs(dx) * 0.5;
      const c1x = isVert ? sx : mx, c1y = isVert ? my : sy;
      const c2x = isVert ? ex : mx, c2y = isVert ? my : ey;

      result.push({
        d: `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`,
        color: edge.color,
        type: edge.relType,
        labelX: mx,
        labelY: my - 6 + spread,
        source: edge.source,
        target: edge.target,
        highlighted: selectedId === edge.source || selectedId === edge.target,
      });
    });
    return result;
  }, [entities, positions, nodeSizes, selectedId, visibleIds]);

  // Collect unique colors for arrow markers
  const markerColors = useMemo(() => {
    const colors = new Map<string, string>();
    paths.forEach((p) => {
      if (!colors.has(p.color)) colors.set(p.color, `c${colors.size}`);
    });
    return colors;
  }, [paths]);

  // Track new paths for draw-in animation via effect
  useEffect(() => {
    const newIndices = new Set<number>();
    paths.forEach((p, i) => {
      const pathKey = `${p.source}|${p.target}|${p.type}`;
      if (!globalDrawnPaths.has(pathKey)) {
        newIndices.add(i);
        globalDrawnPaths.add(pathKey);
      }
    });
    if (newIndices.size > 0) {
      // Schedule state update outside effect body
      requestAnimationFrame(() => setNewPathIndices(newIndices));
    }
  }, [paths]);

  const showFlowDots = !miniMode && paths.length < 200;

  return (
    <svg
      className="absolute top-0 left-0 w-[8000px] h-[8000px] pointer-events-none overflow-visible"
      style={{ zIndex: 10 }}
    >
      <defs>
        {[...markerColors.entries()].map(([color, id]) => (
          <marker
            key={`end-${id}`}
            id={`arrow-end-${id}`}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <polygon points="0,1 10,5 0,9" fill={color} />
          </marker>
        ))}
      </defs>
      {paths.map((p, i) => {
        const cId = markerColors.get(p.color)!;
        const sw = miniMode ? 1.5 : p.highlighted ? 3 : 2;
        const op = miniMode ? 0.5 : p.highlighted ? 1 : 0.7;
        const isNew = newPathIndices.has(i);

        const drawInStyle: React.CSSProperties = isNew
          ? {
            strokeDasharray: 1000,
            strokeDashoffset: 1000,
            animation: "connection-draw 0.8s ease-out forwards",
          }
          : {};

        return (
          <g key={i}>
            {p.highlighted && !miniMode && (
              <path
                d={p.d}
                stroke={p.color}
                strokeWidth={8}
                fill="none"
                opacity={0.15}
                style={{ filter: "blur(4px)" }}
              />
            )}
            <path
              d={p.d}
              stroke={p.color}
              strokeWidth={sw}
              fill="none"
              opacity={op}
              markerEnd={miniMode ? undefined : `url(#arrow-end-${cId})`}
              style={drawInStyle}
            />
            {p.highlighted && showFlowDots && (
              <circle r="3" fill={p.color} opacity={0.8}>
                <animateMotion dur="2s" repeatCount="indefinite" path={p.d} />
              </circle>
            )}
            {!miniMode && paths.length < 200 && (
              <text
                x={p.labelX}
                y={p.labelY}
                textAnchor="middle"
                className="text-[10px] fill-text-secondary pointer-events-none"
              >
                {p.type}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
