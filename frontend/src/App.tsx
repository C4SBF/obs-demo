import { useState, useEffect, useCallback, useRef } from "react";
import type { Entity, NodePosition, DeviceData, DeviceCensus, OntologyInfo } from "./types";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { GraphCanvas } from "./components/GraphCanvas";
import { SchemaEditorModal } from "./components/SchemaEditorModal";
import { OntologyViewerModal } from "./components/OntologyViewerModal";
import { useGraph } from "./hooks/useGraph";
import { resetColorMaps, getEntityColor, getRelationColor } from "./lib/utils";
import { Button } from "@/components/ui/button";
import * as api from "./api";

// Convert graph format (nodes/edges) to entities with relationships
function extractEntities(data: DeviceData[]): Entity[] {
  // Collect all nodes and edges from graph data
  const allNodes: Record<string, unknown>[] = [];
  const allEdges: { source: string; target: string; type: string }[] = [];

  for (const item of data) {
    const raw = item as Record<string, unknown>;
    // Check for _graph property (device with embedded graph)
    const graph = raw._graph as Record<string, unknown> | undefined;
    if (graph && Array.isArray(graph.nodes)) {
      allNodes.push(...(graph.nodes as Record<string, unknown>[]));
      if (Array.isArray(graph.edges)) {
        allEdges.push(...(graph.edges as { source: string; target: string; type: string }[]));
      }
    }
    // Check if item itself is a graph (has nodes at top level)
    else if (Array.isArray(raw.nodes)) {
      allNodes.push(...(raw.nodes as Record<string, unknown>[]));
      if (Array.isArray(raw.edges)) {
        allEdges.push(...(raw.edges as { source: string; target: string; type: string }[]));
      }
    }
  }

  if (allNodes.length === 0) return [];

  // Deduplicate nodes by ID (last occurrence wins, preserving enhanced versions)
  const nodeMap = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    const id = String(node.id || `node-${i}`);
    nodeMap.set(id, node);
  }
  const uniqueNodes = [...nodeMap.values()];

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const uniqueEdges = allEdges.filter((e) => {
    const key = `${e.source}:${e.type}:${e.target}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  // Build edge lookup: source -> list of {type, target}
  const edgesBySource = new Map<string, { type: string; target: string }[]>();
  for (const edge of uniqueEdges) {
    const list = edgesBySource.get(edge.source) || [];
    list.push({ type: edge.type, target: edge.target });
    edgesBySource.set(edge.source, list);
  }

  // Track parent relationships (reverse of hasPoint)
  const parentById = new Map<string, string>();
  for (const edge of uniqueEdges) {
    if (edge.type === "hasPoint") {
      parentById.set(edge.target, edge.source);
    }
  }

  return uniqueNodes.map((node, i) => {
    const id = String(node.id || `node-${i}`);
    const nodeType = String(node.type || "unknown");
    const attrs = (node.attrs || {}) as Record<string, unknown>;
    const tags = Array.isArray(node.tags) ? (node.tags as string[]) : [];

    // Build meta from attrs
    const meta: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "name" || k === "description" || k === "class") continue;
      if (v != null && typeof v === "object") {
        meta[k] = JSON.stringify(v);
      } else if (v != null) {
        meta[k] = String(v);
      }
    }

    // Check if entity has classification candidates
    const candidates = attrs.class_candidates;
    const hasCandidates = Array.isArray(candidates) && candidates.length > 0;

    return {
      id,
      type: nodeType,
      name: typeof attrs.name === "string" ? attrs.name : undefined,
      description: typeof attrs.description === "string" ? attrs.description : undefined,
      class: typeof attrs.class === "string" ? attrs.class : undefined,
      tags,
      relationships: edgesBySource.get(id) || [],
      meta,
      parentId: parentById.get(id),
      aiEnhanced: attrs.llm_enhanced === true,
      hasCandidates,
    };
  });
}

const DEVICES_STORAGE_KEY = "obs-discovery-devices";

function loadSavedDevices(): DeviceData[] | null {
  try {
    const raw = localStorage.getItem(DEVICES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as DeviceData[];
    }
  } catch {
    // ignore invalid cache
  }
  return null;
}

function saveDevices(devices: DeviceData[] | null) {
  try {
    if (devices && devices.length > 0) {
      localStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
    } else {
      localStorage.removeItem(DEVICES_STORAGE_KEY);
    }
  } catch {
    // ignore quota errors
  }
}

function App() {
  const [ontologies, setOntologies] = useState<OntologyInfo[]>([]);
  const [selectedOntology, setSelectedOntology] = useState<string | null>(null);
  const [census, setCensus] = useState<DeviceCensus[] | null>(null);
  const [baseDevices, _setBaseDevices] = useState<DeviceData[] | null>(loadSavedDevices);
  const setBaseDevices = useCallback((devices: DeviceData[] | null) => {
    _setBaseDevices(devices);
    saveDevices(devices);
  }, []);
  const [currentData, setCurrentData] = useState<DeviceData[] | null>(() => baseDevices);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);

  const [, setScannedDeviceIds] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const collectedDevicesRef = useRef<DeviceData[]>([]);
  const failedIdsRef = useRef<number[]>([]);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [showOntologyViewer, setShowOntologyViewer] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classificationCompleted, setClassificationCompleted] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );

  const headerRef = useRef<HTMLDivElement>(null);
  const { computeLayout, computeLayoutAsync } = useGraph();
  const [layoutBusy, setLayoutBusy] = useState(false);
  const layoutGenRef = useRef(0);

  useEffect(() => {
    api.getOntologies().then(setOntologies).catch((e) => setError(String(e)));
    api.getLlmStatus().then((status) => setAiAvailable(status.available));
  }, []);

  useEffect(() => {
    if (!selectedOntology && ontologies.length > 0) {
      setSelectedOntology(ontologies[0].id);
    }
  }, [ontologies, selectedOntology]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty("--header-h", `${el.getBoundingClientRect().height}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!currentData) {
      setEntities([]);
      setPositions({});
      return;
    }
    resetColorMaps();
    const ents = extractEntities(currentData);
    ents.forEach((e) => {
      getEntityColor(e.type);
      (e.relationships || []).forEach((r) => getRelationColor(r.type));
    });
    setEntities(ents);

    if (ents.length > 200) {
      const gen = ++layoutGenRef.current;
      setLayoutBusy(true);
      computeLayoutAsync(ents, "radial").then((pos) => {
        if (layoutGenRef.current === gen) {
          setPositions(pos);
          setLayoutBusy(false);
        }
      });
    } else {
      setPositions(computeLayout(ents, "radial"));
    }
  }, [currentData, computeLayout, computeLayoutAsync]);

  const handleDiscover = useCallback(async () => {
    abortRef.current?.abort();
    setDiscovering(true);
    setPaused(false);
    setError(null);
    setCensus(null);
    setBaseDevices(null);
    setCurrentData(null);
    setScanProgress(null);
    setScannedDeviceIds(new Set());
    setClassificationCompleted(false); // Reset classification state
    try {
      const result = await api.discoverNetwork();
      setCensus(result);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setDiscovering(false);
    }
  }, [setBaseDevices]);

  const handleScanDevices = useCallback((devices: DeviceCensus[], resuming = false) => {
    if (devices.length === 0) return;

    const ac = new AbortController();
    abortRef.current = ac;

    if (!resuming) {
      collectedDevicesRef.current = [];
      failedIdsRef.current = [];
      setScannedDeviceIds(new Set());
      setScanProgress({ done: 0, total: devices.length });
    }

    setScanning(true);
    setPaused(false);
    setError(null);

    const alreadyDone = new Set(collectedDevicesRef.current.map((d) => (d as Record<string, unknown>).device_id as number ?? -1));
    const failedSet = new Set(failedIdsRef.current);
    const remaining = devices.filter((d) => !alreadyDone.has(d.device_id) && !failedSet.has(d.device_id));

    if (remaining.length === 0) {
      setScanning(false);
      return;
    }

    const totalDevices = devices.length;
    const doneIds = new Set(alreadyDone);
    let doneCount = totalDevices - remaining.length;

    const promises = remaining.map((d) =>
      api.discoverDevice(d.device_id, ac.signal)
        .then((device) => {
          collectedDevicesRef.current.push(device);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          failedIdsRef.current.push(d.device_id);
          console.error(`Device ${d.device_id} failed:`, err);
        })
        .finally(() => {
          if (ac.signal.aborted) return;
          doneIds.add(d.device_id);
          doneCount++;

          setScannedDeviceIds(new Set(doneIds));
          setScanProgress({ done: doneCount, total: totalDevices });
          setBaseDevices([...collectedDevicesRef.current]);
          setCurrentData([...collectedDevicesRef.current]);
        }),
    );

    Promise.all(promises).then(() => {
      if (ac.signal.aborted) return;
      setScanning(false);
      setScanProgress(null);

      const failed = failedIdsRef.current;
      if (failed.length > 0) {
        setError(`${failed.length} device(s) failed to scan: ${failed.join(", ")}`);
      }
    });
  }, [setBaseDevices]);

  const handlePauseScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
    setPaused(true);
  }, []);

  const handleResumeScan = useCallback(() => {
    if (!census) return;
    handleScanDevices(census, true);
  }, [census, handleScanDevices]);

  useEffect(() => {
    if (census && census.length > 0 && !scanning && !baseDevices) {
      handleScanDevices(census);
    }
  }, [census, scanning, baseDevices, handleScanDevices]);

  const hasUnclassifiedObjects = useCallback((device: DeviceData): boolean => {
    const asRecord = device as Record<string, unknown>;
    const deviceClass = asRecord.class;
    if (deviceClass === undefined || deviceClass === null || String(deviceClass).trim() === "") {
      return true;
    }
    const points = Array.isArray(asRecord.points) ? asRecord.points as Record<string, unknown>[] : [];
    return points.some((point) => {
      const pointClass = point.class;
      return pointClass === undefined || pointClass === null || String(pointClass).trim() === "";
    });
  }, []);

  const handleClassify = useCallback(async () => {
    if (!selectedOntology || !baseDevices || classifying) return;
    setClassifying(true);
    setError(null);
    try {
      const enrichedByIndex = new Map<number, DeviceData>();
      for (let i = 0; i < baseDevices.length; i++) {
        const device = baseDevices[i];
        if (!hasUnclassifiedObjects(device)) continue;
        const enriched = await api.classify(device, selectedOntology);
        enrichedByIndex.set(i, enriched);
      }
      if (enrichedByIndex.size === 0) return;
      const merged = baseDevices.map((device, i) => {
        return enrichedByIndex.has(i) ? enrichedByIndex.get(i)! : device;
      });
      setBaseDevices(merged);
      setCurrentData(merged);
      setClassificationCompleted(true); // Mark classification as completed
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setClassifying(false);
    }
  }, [selectedOntology, baseDevices, classifying, hasUnclassifiedObjects, setBaseDevices]);

  const handleEnhance = useCallback(async () => {
    if (!baseDevices || enhancing) return;
    setEnhancing(true);

    setError(null);
    try {
      const enhancedByIndex = new Map<number, DeviceData>();
      for (let i = 0; i < baseDevices.length; i++) {
        const device = baseDevices[i];
        const enhanced = await api.enhance(device);
        enhancedByIndex.set(i, enhanced);

      }
      if (enhancedByIndex.size === 0) return;
      const merged = baseDevices.map((device, i) => {
        return enhancedByIndex.has(i) ? enhancedByIndex.get(i)! : device;
      });
      setBaseDevices(merged);
      setCurrentData(merged);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setEnhancing(false);

    }
  }, [baseDevices, enhancing, setBaseDevices]);

  const handleEnhanceEntity = useCallback(async (entityId: string) => {
    if (!baseDevices) return;
    setEnhancing(true);

    setError(null);
    try {
      // Find which device contains this entity
      for (let i = 0; i < baseDevices.length; i++) {
        const device = baseDevices[i];
        const result = await api.enhanceEntity(entityId, device);
        if (result.enhanced) {
          const merged = [...baseDevices];
          merged[i] = result.graph;
          setBaseDevices(merged);
          setCurrentData(merged);

          break;
        }
      }
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setEnhancing(false);

    }
  }, [baseDevices, setBaseDevices]);

  const handleSchemaApply = useCallback(
    (data: Record<string, unknown>) => {
      setShowSchemaEditor(false);
      if (Object.keys(data).length === 0) {
        setBaseDevices(null);
        setCurrentData(null);
        return;
      }
      // Store graph data directly as single-element array
      if (Array.isArray(data.nodes)) {
        const graphData = [data] as DeviceData[];
        setBaseDevices(graphData);
        setCurrentData(graphData);
      }
    },
    [setBaseDevices],
  );

  const handleClearData = useCallback(() => {
    setBaseDevices(null);
    setCurrentData(null);
    setCensus(null);
    setError(null);
    setScanning(false);
    setPaused(false);
    setScanProgress(null);
    setClassificationCompleted(false); // Reset classification state
  }, [setBaseDevices]);

  const handlePositionChange = useCallback((id: string, pos: NodePosition) => {
    setPositions((prev) => ({ ...prev, [id]: pos }));
  }, []);

  // Extract graph format for Schema Editor
  const extractGraph = (data: DeviceData[] | null): Record<string, unknown> => {
    if (!data || data.length === 0) return {};
    const allNodes: unknown[] = [];
    const allEdges: unknown[] = [];
    let meta: unknown = {};
    for (const item of data) {
      const raw = item as Record<string, unknown>;
      // Check for _graph property (device with embedded graph)
      const graph = raw._graph as Record<string, unknown> | undefined;
      if (graph && Array.isArray(graph.nodes)) {
        allNodes.push(...graph.nodes);
        if (Array.isArray(graph.edges)) allEdges.push(...graph.edges);
        if (graph.meta) meta = graph.meta;
      }
      // Check if item itself is a graph (has nodes at top level)
      else if (Array.isArray(raw.nodes)) {
        allNodes.push(...(raw.nodes as unknown[]));
        if (Array.isArray(raw.edges)) allEdges.push(...(raw.edges as unknown[]));
        if (raw.meta) meta = raw.meta;
      }
    }
    if (allNodes.length === 0) return {};
    return { nodes: allNodes, edges: allEdges, meta };
  };

  const schemaEditorData = extractGraph(currentData);
  const schemaEditorRawData = extractGraph(baseDevices);

  // Check if any entities have been classified (have a class property)
  const hasClassifiedData = entities.some((e) => e.class && e.class !== "unknown");

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <div ref={headerRef} className="shrink-0 z-50 relative bg-bg-secondary transform-gpu">
        <Header
          ontologies={ontologies}
          selectedOntology={selectedOntology}
          onSelectOntology={setSelectedOntology}
          onViewOntology={() => setShowOntologyViewer(true)}
          onClassify={handleClassify}
          classifying={classifying}
          classificationCompleted={classificationCompleted}
          onEnhance={handleEnhance}
          enhancing={enhancing}
          aiAvailable={aiAvailable}
          hasClassifiedData={hasClassifiedData}
          onDiscover={handleDiscover}
          onSchemaEdit={() => setShowSchemaEditor(true)}
          discovering={discovering}
          scanning={scanning}
          paused={paused}
          scanProgress={scanProgress}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onPauseScan={handlePauseScan}
          onResumeScan={handleResumeScan}
          hasData={!!baseDevices}
          onClearData={handleClearData}
        />
        {error && (
          <div className="px-5 py-2 bg-accent-red/20 text-accent-red text-sm animate-in fade-in slide-in-from-top-2 duration-200 shadow-[0_4px_20px_rgba(248,81,73,0.15)]">
            {error}
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-3 text-accent-red hover:text-accent-red/80">
              dismiss
            </Button>
          </div>
        )}
      </div>
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          entities={entities}
          selectedId={selectedId}
          onSelect={setSelectedId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <GraphCanvas
          entities={entities}
          positions={positions}
          selectedId={selectedId}
          sidebarOpen={sidebarOpen}
          onSelect={setSelectedId}
          onPositionChange={handlePositionChange}
          onDiscover={handleDiscover}
          discovering={discovering || scanning}
          paused={paused}
          onResumeScan={handleResumeScan}
          onEnhanceEntity={aiAvailable ? handleEnhanceEntity : undefined}
        />
        {layoutBusy && !scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 z-50 pointer-events-none">
            <div className="text-text-secondary text-sm animate-pulse">Computing layout for {entities.length} entities...</div>
          </div>
        )}
      </div>
      {showSchemaEditor && (
        <SchemaEditorModal
          data={schemaEditorData}
          rawData={schemaEditorRawData}
          hasClassified={false}
          onApply={handleSchemaApply}
          onClose={() => setShowSchemaEditor(false)}
        />
      )}
      {showOntologyViewer && selectedOntology && (
        <OntologyViewerModal
          ontologyId={selectedOntology}
          onClose={() => setShowOntologyViewer(false)}
        />
      )}
    </div>
  );
}

export default App;
