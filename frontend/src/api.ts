import type { DeviceCensus, DeviceData, OntologyInfo } from "./types";
import { SAMPLE_CENSUS, SAMPLE_GRAPHS, ONTOLOGIES } from "./fixtures/sample-discovery";

declare const __DEMO__: boolean;

export const isDemo = typeof __DEMO__ !== "undefined" && __DEMO__;

const BASE = "/api";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GraphNode = {
  id: string;
  type: string;
  tags?: string[];
  attrs?: Record<string, unknown>;
};

type GraphEdge = {
  source: string;
  target: string;
  type: string;
  attrs?: Record<string, unknown>;
};

type GraphMeta = {
  created_at?: string;
  source?: string;
  input?: Record<string, unknown>;
  timings?: Record<string, unknown>;
  success?: boolean;
  errors?: string[];
  error_details?: Record<string, unknown>[];
  extra?: Record<string, unknown>;
};

type DiscoveryGraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: GraphMeta;
  census?: DeviceCensus[];
};

function graphToDevice(graph: DiscoveryGraphResponse, requestedDeviceId: number): DeviceData {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const isDeviceNode = (node: GraphNode): boolean => {
    if (node.type === "device") return true;
    if (String(node.attrs?.kind ?? "").toLowerCase() === "device") return true;
    if (String(node.attrs?.type ?? "").toLowerCase() === "device") return true;
    return false;
  };
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edgeTypesFromDevice = new Set(["contains", "hasPoint"]);

  const deviceNode =
    nodes.find((n) => isDeviceNode(n)) ??
    nodes.find((n) => edges.some((e) => e.source === n.id && edgeTypesFromDevice.has(e.type))) ??
    nodes[0];
  if (!deviceNode) {
    throw new Error(`Device ${requestedDeviceId} graph payload has no nodes`);
  }

  const pointIds = new Set(
    edges
      .filter((e) => e.source === deviceNode.id && edgeTypesFromDevice.has(e.type))
      .map((e) => e.target),
  );
  const pointNodesById = new Map<string, GraphNode>();
  for (const pointId of pointIds) {
    const pointNode = nodeById.get(pointId);
    if (pointNode && pointNode.id !== deviceNode.id) {
      pointNodesById.set(pointNode.id, pointNode);
    }
  }
  if (pointNodesById.size === 0) {
    for (const node of nodes) {
      if (node.id === deviceNode.id) continue;
      const hasPointShape =
        node.type === "point" ||
        String(node.attrs?.kind ?? "").toLowerCase() === "point" ||
        String(node.attrs?.type ?? "").toLowerCase() === "point";
      const connectedToDevice = edges.some((e) => {
        if (e.type === "isPointOf") return e.source === node.id && e.target === deviceNode.id;
        return (
          edgeTypesFromDevice.has(e.type) &&
          ((e.source === deviceNode.id && e.target === node.id) || (e.target === deviceNode.id && e.source === node.id))
        );
      });
      if (hasPointShape || connectedToDevice) {
        pointNodesById.set(node.id, node);
      }
    }
  }
  const pointNodes = [...pointNodesById.values()];
  const edgesByTarget = new Map<string, GraphEdge[]>();
  edges.forEach((edge) => {
    const bucket = edgesByTarget.get(edge.target) || [];
    bucket.push(edge);
    edgesByTarget.set(edge.target, bucket);
  });

  // Helper to dedupe relationships by type+target
  const dedupeRels = (rels: { type: string; target: string }[]) => {
    const seen = new Set<string>();
    return rels.filter((r) => {
      const key = `${r.type}:${r.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const device = {
    ...(deviceNode.attrs || {}),
    uid: deviceNode.id,
    id: deviceNode.id,
    kind: deviceNode.type,
    tags: deviceNode.tags || [],
    relationships: dedupeRels(
      edges
        .filter((e) => e.source === deviceNode.id)
        .map((e) => ({ type: e.type, target: e.target })),
    ),
    points: pointNodes.map((p) => ({
      ...(p.attrs || {}),
      uid: p.id,
      id: p.id,
      kind: p.type,
      tags: p.tags || [],
      relationships: dedupeRels(
        (edgesByTarget.get(p.id) || []).map((e) => ({
          type: (e.type === "contains" || e.type === "hasPoint") ? "isPointOf" : e.type,
          target: e.source,
        })),
      ),
    })),
    _graph: graph,
    device_id: requestedDeviceId,
  } as DeviceData;

  return device;
}

/** Level 1: Network census — returns lightweight device list. */
export async function discoverNetwork(
  timeout = 60,
  clientIp?: string,
  bbmdIp?: string,
): Promise<DeviceCensus[]> {
  if (__DEMO__) {
    await delay(3000);
    return SAMPLE_CENSUS;
  }
  const params = new URLSearchParams({ timeout: String(timeout) });
  if (clientIp) params.set("client_ip", clientIp);
  if (bbmdIp) params.set("bbmd_ip", bbmdIp);
  const res = await fetch(`${BASE}/discover?${params}`);
  if (!res.ok) throw new Error(`Census failed: ${res.status}`);
  const payload = await res.json() as DeviceCensus[] | DiscoveryGraphResponse;
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.census) ? payload.census : [];
}

/** Level 2: Scan a single device — returns graph format. */
export async function discoverDevice(deviceId: number, signal?: AbortSignal): Promise<DeviceData> {
  if (__DEMO__) {
    await delay(1200 + Math.random() * 1200);
    const graph = SAMPLE_GRAPHS[deviceId];
    if (!graph) throw new Error(`Device ${deviceId} not found in fixtures`);
    // Return as DeviceData with graph structure
    return { nodes: graph.nodes, edges: graph.edges, meta: graph.meta } as DeviceData;
  }
  const res = await fetch(`${BASE}/discover/${deviceId}/objects`, { signal });
  if (!res.ok) throw new Error(`Device ${deviceId} scan failed: ${res.status}`);
  const payload = await res.json() as DeviceData | DiscoveryGraphResponse;
  if (payload && !Array.isArray(payload) && "nodes" in payload && "edges" in payload) {
    return graphToDevice(payload as DiscoveryGraphResponse, deviceId);
  }
  return payload as DeviceData;
}

function deviceToGraph(device: DeviceData): DiscoveryGraphResponse {
  const raw = device as Record<string, unknown>;
  const deviceId = String(raw.uid ?? raw.id ?? "device");
  const points = Array.isArray(raw.points) ? (raw.points as Record<string, unknown>[]) : [];
  const pointNodes: GraphNode[] = points.map((point, idx) => ({
    id: String(point.uid ?? point.id ?? `${deviceId}:point:${idx}`),
    type: String(point.kind ?? point.type ?? "point"),
    tags: Array.isArray(point.tags) ? (point.tags as string[]) : [],
    attrs: { ...point },
  }));
  const pointNodeIds = new Set(pointNodes.map((p) => p.id));
  pointNodes.forEach((p) => {
    delete (p.attrs as Record<string, unknown>).uid;
    delete (p.attrs as Record<string, unknown>).id;
    delete (p.attrs as Record<string, unknown>).kind;
    delete (p.attrs as Record<string, unknown>).type;
    delete (p.attrs as Record<string, unknown>).tags;
  });
  const deviceAttrs: Record<string, unknown> = { ...raw };
  delete deviceAttrs.points;
  delete deviceAttrs._graph;
  return {
    nodes: [
      {
        id: deviceId,
        type: String(raw.kind ?? raw.type ?? "device"),
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
        attrs: deviceAttrs,
      },
      ...pointNodes,
    ],
    edges: pointNodes
      .filter((node) => pointNodeIds.has(node.id))
      .map((node) => ({ source: deviceId, target: node.id, type: "contains", attrs: {} })),
    meta: { source: "frontend-device-to-graph" },
  };
}

export async function classify(
  device: DeviceData,
  ontologyId: string,
  signal?: AbortSignal,
): Promise<DeviceData> {
  if (__DEMO__) {
    await delay(400);
    return device;
  }
  const raw = device as Record<string, unknown>;
  // Check if input is already a graph (has nodes array directly)
  const isGraphFormat = Array.isArray(raw.nodes);
  let graph: DiscoveryGraphResponse;
  if (isGraphFormat) {
    // Input is already a graph object from Schema Editor
    graph = {
      nodes: raw.nodes as GraphNode[],
      edges: (raw.edges as GraphEdge[]) || [],
      meta: (raw.meta as GraphMeta) || { source: "schema-editor" },
    };
  } else if (raw._graph && typeof raw._graph === "object") {
    graph = raw._graph as DiscoveryGraphResponse;
  } else {
    graph = deviceToGraph(device);
  }
  const requestedDeviceId = Number(raw.device_id ?? 0);
  const res = await fetch(`${BASE}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      graph,
      topology: { id: ontologyId },
      options: { use_llm: false, min_confidence: 0.5 },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Classification failed: ${res.status}`);
  const payload = await res.json() as { graph: DiscoveryGraphResponse };
  // If input was graph format, return enriched graph directly (not as device)
  if (isGraphFormat) {
    return {
      nodes: payload.graph.nodes,
      edges: payload.graph.edges,
      meta: payload.graph.meta,
    } as DeviceData;
  }
  const classified = graphToDevice(payload.graph, requestedDeviceId);
  const originalPoints = Array.isArray((device as Record<string, unknown>).points)
    ? ((device as Record<string, unknown>).points as unknown[])
    : [];
  const classifiedPoints = Array.isArray((classified as Record<string, unknown>).points)
    ? ((classified as Record<string, unknown>).points as unknown[])
    : [];
  if (classifiedPoints.length == 0 && originalPoints.length > 0) {
    return {
      ...(classified as Record<string, unknown>),
      points: originalPoints,
    } as DeviceData;
  }
  return classified;
}

export async function getLlmStatus(): Promise<{ available: boolean }> {
  if (__DEMO__) return { available: false };
  const res = await fetch(`${BASE}/llm/status`);
  if (!res.ok) return { available: false };
  return res.json();
}

type EnhanceOptions = {
  backend?: string;
  model?: string;
  base_url?: string;
  min_confidence_threshold?: number;
};

type EnhancementDetail = {
  node_id: string;
  original_class: string | null;
  original_confidence: number;
  suggested_class: string;
  llm_confidence: number;
  reasoning: string;
  applied: boolean;
};

type EnhanceResult = {
  graph: DiscoveryGraphResponse;
  enhancements: EnhancementDetail[];
  success: boolean;
  errors: string[];
};

/** Enhance full graph with LLM to improve low-confidence classifications. */
export async function enhance(
  device: DeviceData,
  options?: EnhanceOptions,
  signal?: AbortSignal,
): Promise<DeviceData> {
  if (__DEMO__) {
    await delay(800);
    return device;
  }
  const raw = device as Record<string, unknown>;
  const isGraphFormat = Array.isArray(raw.nodes);
  let graph: DiscoveryGraphResponse;
  if (isGraphFormat) {
    graph = {
      nodes: raw.nodes as GraphNode[],
      edges: (raw.edges as GraphEdge[]) || [],
      meta: (raw.meta as GraphMeta) || { source: "schema-editor" },
    };
  } else if (raw._graph && typeof raw._graph === "object") {
    graph = raw._graph as DiscoveryGraphResponse;
  } else {
    graph = deviceToGraph(device);
  }
  const requestedDeviceId = Number(raw.device_id ?? 0);
  const res = await fetch(`${BASE}/enhance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ graph, options: options || {} }),
    signal,
  });
  if (!res.ok) throw new Error(`Enhancement failed: ${res.status}`);
  const payload = await res.json() as EnhanceResult;
  if (isGraphFormat) {
    return {
      nodes: payload.graph.nodes,
      edges: payload.graph.edges,
      meta: payload.graph.meta,
    } as DeviceData;
  }
  return graphToDevice(payload.graph, requestedDeviceId);
}

/** Enhance a single entity (node) with its relationships using LLM. */
export async function enhanceEntity(
  entityId: string,
  fullGraph: DeviceData,
  options?: EnhanceOptions,
  signal?: AbortSignal,
): Promise<{ enhanced: boolean; graph: DeviceData }> {
  if (__DEMO__) {
    await delay(500);
    return { enhanced: false, graph: fullGraph };
  }

  const raw = fullGraph as Record<string, unknown>;
  let sourceGraph: DiscoveryGraphResponse;

  if (Array.isArray(raw.nodes)) {
    sourceGraph = {
      nodes: raw.nodes as GraphNode[],
      edges: (raw.edges as GraphEdge[]) || [],
      meta: (raw.meta as GraphMeta) || {},
    };
  } else if (raw._graph && typeof raw._graph === "object") {
    sourceGraph = raw._graph as DiscoveryGraphResponse;
  } else {
    sourceGraph = deviceToGraph(fullGraph);
  }

  // Find the target node - if not found, silently return unchanged
  const targetNode = sourceGraph.nodes.find((n) => n.id === entityId);
  if (!targetNode) {
    return { enhanced: false, graph: fullGraph };
  }

  // Collect related nodes (1-hop relationships)
  const relatedNodeIds = new Set<string>();
  const relatedEdges: GraphEdge[] = [];

  for (const edge of sourceGraph.edges) {
    if (edge.source === entityId) {
      relatedNodeIds.add(edge.target);
      relatedEdges.push(edge);
    } else if (edge.target === entityId) {
      relatedNodeIds.add(edge.source);
      relatedEdges.push(edge);
    }
  }

  const relatedNodes = sourceGraph.nodes.filter(
    (n) => relatedNodeIds.has(n.id) && n.id !== entityId,
  );

  // Build subgraph with target node and its relations
  const subgraph: DiscoveryGraphResponse = {
    nodes: [targetNode, ...relatedNodes],
    edges: relatedEdges,
    meta: { source: "entity-enhance" },
  };

  // Call enhance with force=true to always apply LLM suggestion for individual nodes
  const res = await fetch(`${BASE}/enhance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      graph: subgraph,
      options: { ...options, min_confidence_threshold: 1.0, force: true },
    }),
    signal,
  });

  if (!res.ok) throw new Error(`Entity enhancement failed: ${res.status}`);
  const payload = await res.json() as EnhanceResult;

  // Find the enhancement for our target node
  const enhancement = payload.enhancements.find((e) => e.node_id === entityId);
  if (!enhancement || !enhancement.applied) {
    return { enhanced: false, graph: fullGraph };
  }

  // Apply enhancement to the FULL graph (not the subgraph we sent to API)
  const isGraphFormat = Array.isArray(raw.nodes);

  // Get the full source graph again to update
  let fullSourceGraph: DiscoveryGraphResponse;
  if (isGraphFormat) {
    fullSourceGraph = {
      nodes: raw.nodes as GraphNode[],
      edges: (raw.edges as GraphEdge[]) || [],
      meta: (raw.meta as GraphMeta) || {},
    };
  } else if (raw._graph && typeof raw._graph === "object") {
    fullSourceGraph = raw._graph as DiscoveryGraphResponse;
  } else {
    fullSourceGraph = deviceToGraph(fullGraph);
  }

  const updatedNodes = fullSourceGraph.nodes.map((n) => {
    if (n.id === entityId) {
      return {
        ...n,
        attrs: {
          ...n.attrs,
          class: enhancement.suggested_class,
          class_confidence: enhancement.llm_confidence,
          llm_enhanced: true,
          llm_reasoning: enhancement.reasoning,
          original_class: enhancement.original_class,
          original_confidence: enhancement.original_confidence,
        },
      };
    }
    return n;
  });

  const updatedGraph: DiscoveryGraphResponse = {
    nodes: updatedNodes,
    edges: fullSourceGraph.edges,
    meta: fullSourceGraph.meta,
  };

  if (isGraphFormat) {
    return {
      enhanced: true,
      graph: {
        nodes: updatedGraph.nodes,
        edges: updatedGraph.edges,
        meta: updatedGraph.meta,
      } as DeviceData,
    };
  }

  const requestedDeviceId = Number(raw.device_id ?? 0);
  return {
    enhanced: true,
    graph: graphToDevice(updatedGraph, requestedDeviceId),
  };
}

export async function getOntologies(): Promise<OntologyInfo[]> {
  if (__DEMO__) {
    return ONTOLOGIES.map((o) => ({ id: o.id, name: o.name, version: o.version }));
  }
  const res = await fetch(`${BASE}/ontologies`);
  if (!res.ok) throw new Error(`Failed to fetch ontologies: ${res.status}`);
  return res.json();
}

export async function getOntology(id: string): Promise<Record<string, unknown>> {
  if (__DEMO__) {
    const entry = ONTOLOGIES.find((o) => o.id === id);
    if (!entry) throw new Error(`Ontology ${id} not found`);
    const res = await fetch(entry.url);
    if (!res.ok) throw new Error(`Failed to fetch ontology from ${entry.url}: ${res.status}`);
    return res.json();
  }
  const res = await fetch(`${BASE}/ontologies/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch ontology: ${res.status}`);
  return res.json();
}
