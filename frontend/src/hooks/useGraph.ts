import { useCallback } from "react";
import type { Entity, NodePosition } from "../types";

export type LayoutType = "hierarchical" | "radial" | "grid";

interface LayoutResult {
  positions: Record<string, NodePosition>;
}

function buildTree(entities: Entity[]) {
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  entities.forEach((e) => {
    children.set(e.id, []);
    parents.set(e.id, []);
  });
  entities.forEach((e) => {
    // Prefer explicit parentId (standard format nesting)
    if (e.parentId && entityMap.has(e.parentId)) {
      if (!children.get(e.parentId)!.includes(e.id)) {
        children.get(e.parentId)!.push(e.id);
      }
      if (!parents.get(e.id)!.includes(e.parentId)) {
        parents.get(e.id)!.push(e.parentId);
      }
      return;
    }
    // Fall back to relationships (semantic format)
    (e.relationships || []).forEach((rel) => {
      if (!entityMap.has(rel.target)) return;
      const isChildOf = rel.type?.startsWith("is");
      const parentId = isChildOf ? rel.target : e.id;
      const childId = isChildOf ? e.id : rel.target;
      if (!children.get(parentId)!.includes(childId)) {
        children.get(parentId)!.push(childId);
      }
      if (!parents.get(childId)!.includes(parentId)) {
        parents.get(childId)!.push(parentId);
      }
    });
  });
  return { entityMap, children, parents };
}

/** Sort nodes so same-type entities are grouped together, with extra gap between types */
function sortByType(nodes: Entity[]): { sorted: Entity[]; typeBreaks: number } {
  const byType = new Map<string, Entity[]>();
  nodes.forEach((e) => {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e);
  });
  const sorted: Entity[] = [];
  let typeBreaks = 0;
  for (const group of byType.values()) {
    if (sorted.length > 0) typeBreaks++;
    sorted.push(...group);
  }
  return { sorted, typeBreaks };
}

function layoutHierarchical(entities: Entity[]): LayoutResult {
  const NODE_W = 260, NODE_H = 80, H_GAP = 60, V_GAP = 60, GROUP_GAP = 150, TYPE_GAP = 100;
  const positions: Record<string, NodePosition> = {};
  const { entityMap, children, parents } = buildTree(entities);

  // Connected components via BFS
  const adj = new Map<string, Set<string>>();
  entities.forEach((e) => adj.set(e.id, new Set()));
  entities.forEach((e) => {
    (e.relationships || []).forEach((r) => {
      if (entityMap.has(r.target)) {
        adj.get(e.id)!.add(r.target);
        adj.get(r.target)!.add(e.id);
      }
    });
  });

  const visited = new Set<string>();
  const components: Entity[][] = [];
  entities.forEach((e) => {
    if (visited.has(e.id)) return;
    const comp: Entity[] = [];
    const q = [e.id];
    while (q.length) {
      const id = q.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      comp.push(entityMap.get(id)!);
      adj.get(id)!.forEach((n) => { if (!visited.has(n)) q.push(n); });
    }
    components.push(comp);
  });
  components.sort((a, b) => b.length - a.length);

  let currentX = 50;
  for (const comp of components) {
    const compIds = new Set(comp.map((e) => e.id));
    const roots = comp.filter((e) => parents.get(e.id)!.filter((p) => compIds.has(p)).length === 0);
    const actualRoots = roots.length ? roots : [comp.reduce((best, e) =>
      (children.get(e.id)!.length > children.get(best.id)!.length ? e : best), comp[0])];

    const levels = new Map<string, number>();
    const lv = new Set<string>();
    const q = actualRoots.map((r) => ({ id: r.id, level: 0 }));
    while (q.length) {
      const { id, level } = q.shift()!;
      if (lv.has(id)) continue;
      lv.add(id);
      levels.set(id, level);
      children.get(id)!.forEach((c) => { if (!lv.has(c)) q.push({ id: c, level: level + 1 }); });
    }
    comp.forEach((e) => { if (!levels.has(e.id)) levels.set(e.id, 0); });

    const levelGroups = new Map<number, Entity[]>();
    comp.forEach((e) => {
      const l = levels.get(e.id)!;
      if (!levelGroups.has(l)) levelGroups.set(l, []);
      levelGroups.get(l)!.push(e);
    });

    const sortedLevels = [...levelGroups.keys()].sort((a, b) => a - b);
    let maxLevelWidth = 0;
    sortedLevels.forEach((l) => {
      const { sorted, typeBreaks } = sortByType(levelGroups.get(l)!);
      levelGroups.set(l, sorted);
      const lw = sorted.length * (NODE_W + H_GAP) - H_GAP + typeBreaks * TYPE_GAP;
      maxLevelWidth = Math.max(maxLevelWidth, lw);
    });
    const compWidth = maxLevelWidth;

    sortedLevels.forEach((level, li) => {
      const nodes = levelGroups.get(level)!;
      const typeBreaks = nodes.reduce((n, e, i) => n + (i > 0 && e.type !== nodes[i - 1].type ? 1 : 0), 0);
      const lw = nodes.length * (NODE_W + H_GAP) - H_GAP + typeBreaks * TYPE_GAP;
      const ox = (compWidth - lw) / 2;
      let xOff = 0;
      let prevType = nodes[0]?.type;
      nodes.forEach((e, ni) => {
        if (ni > 0 && e.type !== prevType) {
          xOff += TYPE_GAP;
          prevType = e.type;
        }
        positions[e.id] = { x: currentX + ox + ni * (NODE_W + H_GAP) + xOff, y: 50 + li * (NODE_H + V_GAP) };
      });
    });
    currentX += compWidth + GROUP_GAP;
  }

  // Overlap removal pass
  const allIds = entities.map((e) => e.id);
  const maxIter = allIds.length > 1000 ? 5 : allIds.length > 500 ? 15 : 50;
  for (let it = 0; it < maxIter; it++) {
    let anyOverlap = false;
    for (let i = 0; i < allIds.length; i++) {
      const p1 = positions[allIds[i]];
      for (let j = i + 1; j < allIds.length; j++) {
        const p2 = positions[allIds[j]];
        const ox = (NODE_W + H_GAP) - Math.abs(p1.x - p2.x);
        const oy = (NODE_H + V_GAP) - Math.abs(p1.y - p2.y);
        if (ox > 0 && oy > 0) {
          anyOverlap = true;
          if (ox < oy) {
            const push = ox / 2 + 1;
            if (p1.x <= p2.x) { p1.x -= push; p2.x += push; }
            else { p1.x += push; p2.x -= push; }
          } else {
            const push = oy / 2 + 1;
            if (p1.y <= p2.y) { p1.y -= push; p2.y += push; }
            else { p1.y += push; p2.y -= push; }
          }
        }
      }
    }
    if (!anyOverlap) break;
  }

  return { positions };
}

function layoutRadial(entities: Entity[]): LayoutResult {
  const positions: Record<string, NodePosition> = {};
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const NODE_W = 260, NODE_H = 80, GAP = 50;

  // Build adjacency + find connected components
  const adj = new Map<string, Set<string>>();
  entities.forEach((e) => adj.set(e.id, new Set()));
  entities.forEach((e) => {
    (e.relationships || []).forEach((r) => {
      if (entityMap.has(r.target)) {
        adj.get(e.id)!.add(r.target);
        adj.get(r.target)!.add(e.id);
      }
    });
  });

  const visited = new Set<string>();
  const components: Entity[][] = [];
  entities.forEach((e) => {
    if (visited.has(e.id)) return;
    const comp: Entity[] = [];
    const q = [e.id];
    while (q.length) {
      const id = q.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      comp.push(entityMap.get(id)!);
      adj.get(id)!.forEach((n) => { if (!visited.has(n)) q.push(n); });
    }
    components.push(comp);
  });
  components.sort((a, b) => b.length - a.length);

  // Layout each component as concentric rings: hub in center, children in rings
  const clusterPositions: { cx: number; cy: number; r: number; w: number; h: number; ofsX: number; ofsY: number }[] = [];
  // Max nodes per ring — keeps rings at a reasonable radius
  const MAX_PER_RING = 20;

  for (const comp of components) {
    // Find hub: node with most connections
    const hub = comp.reduce((best, e) =>
      (adj.get(e.id)!.size > adj.get(best.id)!.size ? e : best), comp[0]);
    // Sort children by type so same-type nodes are grouped together in rings
    const children = sortByType(comp.filter((e) => e.id !== hub.id)).sorted;

    // Place hub at origin (center of node, offset later)
    positions[hub.id] = { x: -NODE_W / 2, y: -NODE_H / 2 };

    // Distribute children across concentric circular rings
    const spacing = NODE_W + GAP;
    let placed = 0;
    let ring = 1;
    while (placed < children.length) {
      const perRing = Math.min(MAX_PER_RING * ring, children.length - placed);
      const minCircumference = perRing * spacing;
      const ringR = Math.max(ring * spacing, minCircumference / (2 * Math.PI));

      for (let i = 0; i < perRing; i++) {
        const e = children[placed + i];
        const a = (2 * Math.PI * i) / perRing - Math.PI / 2;
        positions[e.id] = {
          x: ringR * Math.cos(a) - NODE_W / 2,
          y: ringR * Math.sin(a) - NODE_H / 2,
        };
      }
      placed += perRing;
      ring++;
    }

    // Compute actual bounding box of this cluster from placed positions
    let cMinX = Infinity, cMinY = Infinity, cMaxX = -Infinity, cMaxY = -Infinity;
    comp.forEach((e) => {
      const p = positions[e.id];
      cMinX = Math.min(cMinX, p.x);
      cMinY = Math.min(cMinY, p.y);
      cMaxX = Math.max(cMaxX, p.x + NODE_W);
      cMaxY = Math.max(cMaxY, p.y + NODE_H);
    });
    clusterPositions.push({
      cx: 0, cy: 0,
      r: 0,
      w: cMaxX - cMinX,
      h: cMaxY - cMinY,
      ofsX: (cMinX + cMaxX) / 2, // center offset from origin
      ofsY: (cMinY + cMaxY) / 2,
    });
  }

  // Arrange clusters in a row (no grid — avoids vertical overlap)
  const CLUSTER_GAP = GAP * 3;
  let cursorX = 50;

  for (let ci = 0; ci < components.length; ci++) {
    const comp = components[ci];
    const cp = clusterPositions[ci];

    const shiftX = cursorX + cp.w / 2 - cp.ofsX;
    const shiftY = 50 + cp.h / 2 - cp.ofsY;

    comp.forEach((e) => {
      positions[e.id].x += shiftX;
      positions[e.id].y += shiftY;
    });

    cursorX += cp.w + CLUSTER_GAP;
  }

  // Overlap removal pass
  const allIds = entities.map((e) => e.id);
  const maxIter = allIds.length > 1000 ? 5 : allIds.length > 500 ? 15 : 50;
  for (let it = 0; it < maxIter; it++) {
    let anyOverlap = false;
    for (let i = 0; i < allIds.length; i++) {
      const p1 = positions[allIds[i]];
      for (let j = i + 1; j < allIds.length; j++) {
        const p2 = positions[allIds[j]];
        const ox = (NODE_W + GAP) - Math.abs(p1.x - p2.x);
        const oy = (NODE_H + GAP) - Math.abs(p1.y - p2.y);
        if (ox > 0 && oy > 0) {
          anyOverlap = true;
          if (ox < oy) {
            const push = ox / 2 + 1;
            if (p1.x <= p2.x) { p1.x -= push; p2.x += push; }
            else { p1.x += push; p2.x -= push; }
          } else {
            const push = oy / 2 + 1;
            if (p1.y <= p2.y) { p1.y -= push; p2.y += push; }
            else { p1.y += push; p2.y -= push; }
          }
        }
      }
    }
    if (!anyOverlap) break;
  }

  // Normalize
  let minX = Infinity, minY = Infinity;
  entities.forEach((e) => { minX = Math.min(minX, positions[e.id].x); minY = Math.min(minY, positions[e.id].y); });
  entities.forEach((e) => { positions[e.id].x -= minX - 50; positions[e.id].y -= minY - 50; });

  return { positions };
}

function layoutGrid(entities: Entity[]): LayoutResult {
  const positions: Record<string, NodePosition> = {};
  const cols = Math.ceil(Math.sqrt(entities.length));
  entities.forEach((e, i) => {
    positions[e.id] = { x: 50 + (i % cols) * 380, y: 50 + Math.floor(i / cols) * 300 };
  });
  return { positions };
}

function computeLayoutSync(entities: Entity[], type: LayoutType): Record<string, NodePosition> {
  if (!entities.length) return {};
  switch (type) {
    case "hierarchical": return layoutHierarchical(entities).positions;
    case "radial": return layoutRadial(entities).positions;
    case "grid": return layoutGrid(entities).positions;
  }
}

export function useGraph() {
  const computeLayout = useCallback((entities: Entity[], type: LayoutType): Record<string, NodePosition> => {
    return computeLayoutSync(entities, type);
  }, []);

  /** Async version — yields to the browser before heavy computation so the UI stays responsive. */
  const computeLayoutAsync = useCallback((entities: Entity[], type: LayoutType): Promise<Record<string, NodePosition>> => {
    return new Promise((resolve) => {
      // Yield a frame so React can paint a loading state before we block
      requestAnimationFrame(() => {
        setTimeout(() => {
          resolve(computeLayoutSync(entities, type));
        }, 0);
      });
    });
  }, []);

  return { computeLayout, computeLayoutAsync };
}
