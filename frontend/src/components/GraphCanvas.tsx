import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import type { Entity, NodePosition } from "../types";
import { NodeCard } from "./NodeCard";
import { MiniNode } from "./MiniNode";
import { Connections } from "./Connections";
import { Legend } from "./Legend";
import { ZoomControls } from "./ZoomControls";
import { Sparkle, Wind, Thermometer, Droplet, Wifi, Lightbulb, Zap, Cpu, Play, Search } from "lucide-react";

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 1;
const ZOOM_SENSITIVITY = 0.01;
const LOD_ZOOM_THRESHOLD = 0.35; // below this, render lightweight mini-nodes

interface Props {
  entities: Entity[];
  positions: Record<string, NodePosition>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, pos: NodePosition) => void;
  sidebarOpen?: boolean;
  /** Callback to trigger discover flow from the CTA hero */
  onDiscover?: () => void;
  /** Whether discovery is currently running */
  discovering?: boolean;
  /** Whether scanning is paused */
  paused?: boolean;
  /** Callback to resume a paused scan */
  onResumeScan?: () => void;
  /** Callback to enhance a single entity with AI */
  onEnhanceEntity?: (entityId: string) => Promise<void>;
}

export function GraphCanvas({ entities, positions, selectedId, onSelect, onPositionChange, sidebarOpen, onDiscover, discovering, paused, onResumeScan, onEnhanceEntity }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  // Use a ref as the source of truth so zoom+pan update synchronously
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0, w: 0, h: 0 });
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  // ── Discovery animation state machine ──
  // "idle" → "arriving" (hub scales in) → "radar" (scanning) → "fading" (hub fades) → "idle"
  // Debounces the `discovering` prop so brief gaps between census→scan don't reset.
  type ScanPhase = "idle" | "arriving" | "radar" | "fading";
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const hadEntitiesRef = useRef(entities.length > 0);
  // Captures whether the icon should scale-in (from dot) at transition time — stable across renders
  const [iconScaleIn, setIconScaleIn] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (discovering) {
      // Cancel any pending "stop" debounce
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      if (scanPhase === "idle" || scanPhase === "fading") {
        const scaleIn = hadEntitiesRef.current;
        setIconScaleIn(scaleIn);
        enteredEntitiesRef.current.clear();
        setScanPhase("arriving");
        const delay = scaleIn ? 800 : 1000;
        phaseTimerRef.current = setTimeout(() => setScanPhase("radar"), delay);
      }
    } else {
      // Debounce: wait 200ms to confirm discovering truly stopped (avoids census→scan gap)
      if (scanPhase === "arriving" || scanPhase === "radar") {
        debounceRef.current = setTimeout(() => {
          setScanPhase("fading");
          fadeTimerRef.current = setTimeout(() => setScanPhase("idle"), 800);
        }, 200);
      }
    }
    hadEntitiesRef.current = entities.length > 0;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [discovering]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep hadEntitiesRef up to date between discovering transitions
  useEffect(() => {
    if (scanPhase === "idle") hadEntitiesRef.current = entities.length > 0;
  }, [entities.length, scanPhase]);
  const radarActive = scanPhase === "radar";
  const hubFadingOut = scanPhase === "fading";
  const hubVisible = scanPhase !== "idle";
  const showEntities = scanPhase === "idle";
  const showHero = entities.length === 0 || hubVisible;
  const showHeroRef = useRef(showHero);
  showHeroRef.current = showHero;
  const prevPhaseRef = useRef<ScanPhase>("idle");

  // Randomly spawned equipment icons during radar phase
  const EQUIP_ICONS = useMemo(() => [Sparkle, Wind, Thermometer, Droplet, Wifi, Lightbulb, Zap, Cpu], []);
  const EQUIP_COLORS = useMemo(() => ["#58a6ff", "#f85149", "#3fb950", "#d29922", "#a371f7"], []);
  const spawnIdRef = useRef(0);
  const [equipSpawns, setEquipSpawns] = useState<
    { id: number; angle: number; radius: number; iconIdx: number; colorIdx: number; born: number }[]
  >([]);

  useEffect(() => {
    if (!radarActive) {
      setEquipSpawns([]);
      return;
    }
    if (paused) return; // don't spawn new icons while paused
    const spawn = () => {
      const id = ++spawnIdRef.current;
      const angle = Math.random() * 360;
      const radius = 10 + Math.random() * 32;
      const iconIdx = Math.floor(Math.random() * EQUIP_ICONS.length);
      const colorIdx = Math.floor(Math.random() * EQUIP_COLORS.length);
      setEquipSpawns((prev) => {
        const alive = prev.length >= 8 ? prev.slice(1) : prev;
        return [...alive, { id, angle, radius, iconIdx, colorIdx, born: Date.now() }];
      });
    };
    spawn();
    setTimeout(spawn, 200);
    const iv = setInterval(() => {
      spawn();
      if (Math.random() < 0.4) {
        setTimeout(spawn, 150 + Math.random() * 300);
      }
    }, 800 + Math.random() * 800);
    return () => clearInterval(iv);
  }, [radarActive, paused, EQUIP_ICONS.length, EQUIP_COLORS.length]);

  // Track which entities have already entered (for entrance animation)
  const enteredEntitiesRef = useRef<Set<string>>(new Set());

  // Apply view state directly to DOM — no React re-render needed
  const recalcCullingRef = useRef<() => void>(() => { });
  const syncDOM = useCallback(() => {
    const v = viewRef.current;
    const grid = gridRef.current;
    const layer = transformRef.current;
    if (grid) {
      grid.style.backgroundSize = `${32 * v.zoom}px ${32 * v.zoom}px`;
      grid.style.backgroundPosition = `${v.panX}px ${v.panY}px`;
    }
    if (layer) {
      layer.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
    }
    recalcCullingRef.current();
  }, []);

  // Freeze zoom at 40% while hero is displayed
  useEffect(() => {
    if (showHero) {
      const v = viewRef.current;
      const el = containerRef.current;
      v.zoom = 1;
      v.panX = el ? el.offsetWidth / 2 : 0;
      v.panY = el ? el.offsetHeight / 2 : 0;
      syncDOM();
    }
  }, [showHero, syncDOM]);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const touchRef = useRef<{ lastDist: number; lastCenter: { x: number; y: number }; panning: boolean }>({ lastDist: 0, lastCenter: { x: 0, y: 0 }, panning: false });
  const [animating, setAnimating] = useState(false);
  const [nodeSizes, setNodeSizes] = useState<Record<string, { w: number; h: number }>>({});
  const pendingFitRef = useRef(false);
  // Layout animation: JS-driven interpolation so cards + connections + viewport move together
  const layoutAnimRef = useRef<{
    from: Record<string, NodePosition>;
    to: Record<string, NodePosition>;
    fromView: { zoom: number; panX: number; panY: number };
    toView: { zoom: number; panX: number; panY: number };
    startTime: number;
    duration: number;
    rafId: number;
  } | null>(null);
  const [renderPositions, setRenderPositions] = useState<Record<string, NodePosition>>(positions);
  const selectedFromCanvasRef = useRef(false);

  // Level-of-detail: use lightweight mini-nodes when zoomed out
  const useMiniNodes = viewRef.current.zoom < LOD_ZOOM_THRESHOLD;

  // Viewport culling when zoomed in — skip nodes far outside the view (1 screen buffer each side)
  // In mini mode all nodes are cheap, so render everything.
  // Debounced: recalculate when pan/zoom settles (triggered by syncDOM).
  const visibleEntityIdsRef = useRef<Set<string> | null>(null);
  const cullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cullTick, setCullTick] = useState(0);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewRef.current.w = entry.contentRect.width;
        viewRef.current.h = entry.contentRect.height;
      }
    });
    ro.observe(el);
    // Initial size
    viewRef.current.w = el.offsetWidth;
    viewRef.current.h = el.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // Sync culling calculation
  const performCulling = useCallback((v: { zoom: number; panX: number; panY: number; w: number; h: number }) => {
    // Only cull for large datasets — small counts don't need it
    if (entities.length < 500) return null;

    const cw = v.w;
    const ch = v.h;
    // Buffer: 4 screens around viewport to prevent pop-in during zoom/pan
    const bufX = cw * 4;
    const bufY = ch * 4;

    const worldLeft = (-v.panX - bufX) / v.zoom;
    const worldTop = (-v.panY - bufY) / v.zoom;
    const worldRight = (cw - v.panX + bufX) / v.zoom;
    const worldBottom = (ch - v.panY + bufY) / v.zoom;

    const NODE_W = 260, NODE_H = 80;
    const ids = new Set<string>();

    for (const e of entities) {
      const p = renderPositions[e.id];
      if (!p) continue;
      // Simple bounding box check
      if (p.x + NODE_W >= worldLeft && p.x <= worldRight && p.y + NODE_H >= worldTop && p.y <= worldBottom) {
        ids.add(e.id);
      }
    }
    return ids;
  }, [entities, renderPositions]);

  const recalcCulling = useCallback(() => {
    if (cullTimerRef.current) clearTimeout(cullTimerRef.current);
    cullTimerRef.current = setTimeout(() => {
      const v = viewRef.current;
      const ids = performCulling(v);
      if (ids) {
        visibleEntityIdsRef.current = ids;
        setCullTick((n) => n + 1);
      } else if (visibleEntityIdsRef.current !== null) {
        // Stop culling if count dropped < 500
        visibleEntityIdsRef.current = null;
        setCullTick((n) => n + 1);
      }
    }, 60);
  }, [performCulling]);

  recalcCullingRef.current = recalcCulling;

  // Trigger culling recalculation when entities or positions change
  useEffect(() => { recalcCulling(); }, [recalcCulling]);

  const visibleEntityIds = visibleEntityIdsRef.current;

  // Zoom toward a point (defaults to viewport center)
  const zoomTo = useCallback(
    (newZoom: number, cx?: number, cy?: number) => {
      const v = viewRef.current;
      const wasMini = v.zoom < LOD_ZOOM_THRESHOLD;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
      let px = cx, py = cy;
      if (px === undefined || py === undefined) {
        const el = containerRef.current;
        if (el) { px = el.offsetWidth / 2; py = el.offsetHeight / 2; }
        else { v.zoom = clamped; syncDOM(); return; }
      }
      const r = clamped / v.zoom;
      v.panX = px - (px - v.panX) * r;
      v.panY = py - (py - v.panY) * r;
      v.zoom = clamped;
      syncDOM();

      const isMini = v.zoom < LOD_ZOOM_THRESHOLD;
      if (wasMini !== isMini) {
        // If switching from Mini -> Card (zoom IN), force synchronous cull update
        // to avoid rendering 1000s of cards for a split second.
        if (!isMini) {
          const ids = performCulling(v);
          if (ids) visibleEntityIdsRef.current = ids;
        }
        rerender();
      }
    },
    [syncDOM, rerender, performCulling],
  );

  const fitToScreen = useCallback((animate = true) => {
    if (!entities.length || !containerRef.current) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entities.forEach((e) => {
      const p = positions[e.id];
      if (p) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + 280);
        maxY = Math.max(maxY, p.y + 150);
      }
    });
    if (minX === Infinity) return;
    const cw = containerRef.current.offsetWidth;
    const ch = containerRef.current.offsetHeight;
    const ew = maxX - minX + 100;
    const eh = maxY - minY + 100;
    let z = Math.min(cw / ew, ch / eh, 1.5);
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    const v = viewRef.current;
    v.zoom = z;
    v.panX = (cw - ew * z) / 2 - minX * z + 50;
    v.panY = (ch - eh * z) / 2 - minY * z + 50;
    if (animate) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 500);
    }
    rerender();
  }, [entities, positions, rerender]);

  // Auto-fit on first load — trigger when positions are actually available
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (!hasFittedRef.current && entities.length > 0 && Object.keys(positions).length >= entities.length) {
      hasFittedRef.current = true;
      fitToScreen(false);
    }
  }, [entities, positions, fitToScreen]);

  // Fit all entities to screen after discovery completes (fading → idle)
  useEffect(() => {
    if (prevPhaseRef.current === "fading" && scanPhase === "idle" && entities.length > 0) {
      // Small delay so entrance animations have started and nodes are in the DOM
      setTimeout(() => fitToScreen(true), 50);
    }
    prevPhaseRef.current = scanPhase;
  }, [scanPhase, entities.length, fitToScreen]);

  // Layout animation tick — interpolates positions + viewport together
  const animateTick = useCallback(() => {
    const anim = layoutAnimRef.current;
    if (!anim) return;
    const elapsed = performance.now() - anim.startTime;
    const rawT = Math.min(elapsed / anim.duration, 1);
    // ease-out cubic
    const t = 1 - Math.pow(1 - rawT, 3);

    // Interpolate node positions
    const interpolated: Record<string, NodePosition> = {};
    for (const id of Object.keys(anim.to)) {
      const from = anim.from[id] || anim.to[id];
      const to = anim.to[id];
      interpolated[id] = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
    }
    setRenderPositions(interpolated);

    // Interpolate viewport
    const v = viewRef.current;
    const fv = anim.fromView, tv = anim.toView;
    v.zoom = fv.zoom + (tv.zoom - fv.zoom) * t;
    v.panX = fv.panX + (tv.panX - fv.panX) * t;
    v.panY = fv.panY + (tv.panY - fv.panY) * t;
    syncDOM();

    if (rawT < 1) {
      anim.rafId = requestAnimationFrame(animateTick);
    } else {
      layoutAnimRef.current = null;
      setRenderPositions(anim.to);
      rerender();
    }
  }, [syncDOM, rerender]);

  // Compute fit-to-screen viewport for a given set of positions (without applying)
  const computeFitView = useCallback((pos: Record<string, NodePosition>) => {
    const v = viewRef.current;
    const el = containerRef.current;
    if (!el || !entities.length) return { zoom: v.zoom, panX: v.panX, panY: v.panY };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entities.forEach((e) => {
      const p = pos[e.id];
      if (p) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + 280);
        maxY = Math.max(maxY, p.y + 150);
      }
    });
    if (minX === Infinity) return { zoom: v.zoom, panX: v.panX, panY: v.panY };
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const ew = maxX - minX + 100;
    const eh = maxY - minY + 100;
    let z = Math.min(cw / ew, ch / eh, 1.5);
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    return {
      zoom: z,
      panX: (cw - ew * z) / 2 - minX * z + 50,
      panY: (ch - eh * z) / 2 - minY * z + 50,
    };
  }, [entities]);

  // Start layout animation when positions change from a layout switch
  useLayoutEffect(() => {
    if (pendingFitRef.current && entities.length > 0) {
      pendingFitRef.current = false;

      // Cancel any existing animation
      if (layoutAnimRef.current) {
        cancelAnimationFrame(layoutAnimRef.current.rafId);
      }

      const v = viewRef.current;
      const fromView = { zoom: v.zoom, panX: v.panX, panY: v.panY };
      const toView = computeFitView(positions);

      layoutAnimRef.current = {
        from: { ...renderPositions },
        to: positions,
        fromView,
        toView,
        startTime: performance.now(),
        duration: 500,
        rafId: 0,
      };
      layoutAnimRef.current.rafId = requestAnimationFrame(animateTick);
      return;
    }
    // Normal position update (no layout change) — apply directly
    if (!layoutAnimRef.current) {
      setRenderPositions(positions);
    }
  }, [positions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (layoutAnimRef.current) {
        cancelAnimationFrame(layoutAnimRef.current.rafId);
      }
    };
  }, []);

  // Measure node card dimensions — runs synchronously before paint so connections
  // always have accurate sizes on the very first visible frame.
  const measureNodes = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const sizes: Record<string, { w: number; h: number }> = {};
    el.querySelectorAll<HTMLElement>("[data-id]").forEach((node) => {
      const nodeId = node.dataset.id!;
      sizes[nodeId] = { w: node.offsetWidth, h: node.offsetHeight };
    });
    setNodeSizes((prev) => {
      for (const id of Object.keys(sizes)) {
        const p = prev[id];
        if (!p || p.w !== sizes[id].w || p.h !== sizes[id].h) return sizes;
      }
      if (Object.keys(prev).length !== Object.keys(sizes).length) return sizes;
      return prev;
    });
  }, []);

  // Immediate measurement after entities change (before browser paints)
  useLayoutEffect(() => { measureNodes(); }, [entities, cullTick, measureNodes]);

  // ResizeObserver: re-measure when any node card changes size (e.g. content reflow)
  useEffect(() => {
    const root = transformRef.current;
    if (!root) return;
    const ro = new ResizeObserver(measureNodes);
    root.querySelectorAll<HTMLElement>("[data-id]").forEach((n) => ro.observe(n));
    // Watch for added/removed nodes so we observe new cards too
    const mo = new MutationObserver(() => {
      ro.disconnect();
      root.querySelectorAll<HTMLElement>("[data-id]").forEach((n) => ro.observe(n));
    });
    mo.observe(root, { childList: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [entities, cullTick, measureNodes]);

  // Smooth wheel zoom toward mouse position with momentum
  const wheelRef = useRef<{ velocity: number; mx: number; my: number; raf: number } | null>(null);
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (showHeroRef.current) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const w = wheelRef.current;
      if (w) {
        // Accumulate velocity; update cursor position
        w.velocity += e.deltaY;
        w.mx = mx;
        w.my = my;
        return;
      }

      const state = { velocity: e.deltaY, mx, my, raf: 0 };
      wheelRef.current = state;

      const tick = () => {
        state.velocity *= 0.75; // friction — decelerates each frame
        const v = viewRef.current;
        // Exponential zoom: work in log-space so zooming slows down at higher levels
        const logZoom = Math.log(v.zoom);
        const newLogZoom = logZoom - state.velocity * ZOOM_SENSITIVITY * 0.15;
        zoomTo(Math.exp(newLogZoom), state.mx, state.my);
        if (Math.abs(state.velocity) > 0.3) {
          state.raf = requestAnimationFrame(tick);
        } else {
          wheelRef.current = null;
        }
      };
      state.raf = requestAnimationFrame(tick);
    },
    [zoomTo],
  );

  // Pan — start panning from any click that's not on a card
  const onBgMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (showHeroRef.current) return;
      if ((e.target as HTMLElement).closest("[data-id]")) return;
      const v = viewRef.current;
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - v.panX, y: e.clientY - v.panY };
      e.preventDefault();
    },
    [],
  );

  // Node drag start — uses ref for positions to keep callback stable
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const onNodeMouseDown = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = containerRef.current!.getBoundingClientRect();
      const v = viewRef.current;
      const p = positionsRef.current[id] || { x: 0, y: 0 };
      dragOffsetRef.current = {
        x: (e.clientX - rect.left - v.panX) / v.zoom - p.x,
        y: (e.clientY - rect.top - v.panY) / v.zoom - p.y,
      };
      setDragId(id);
      selectedFromCanvasRef.current = true;
      onSelectRef.current(id);
    },
    [],
  );

  // Stable per-node mousedown handler via ref map (avoids inline closures in render)
  const nodeHandlersRef = useRef(new Map<string, (e: React.MouseEvent) => void>());
  const getNodeMouseDown = useCallback((id: string) => {
    let handler = nodeHandlersRef.current.get(id);
    if (!handler) {
      handler = (e: React.MouseEvent) => onNodeMouseDown(id, e);
      nodeHandlersRef.current.set(id, handler);
    }
    return handler;
  }, [onNodeMouseDown]);

  // Global mouse move / up
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const v = viewRef.current;
      if (isPanning) {
        v.panX = e.clientX - panStartRef.current.x;
        v.panY = e.clientY - panStartRef.current.y;
        syncDOM();
      }
      if (dragId && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - v.panX) / v.zoom - dragOffsetRef.current.x;
        const y = (e.clientY - rect.top - v.panY) / v.zoom - dragOffsetRef.current.y;
        onPositionChange(dragId, { x, y });
      }
    };
    const onMouseUp = () => {
      setIsPanning(false);
      setDragId(null);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isPanning, dragId, onPositionChange, syncDOM]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      const v = viewRef.current;
      if (e.key === "r" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fitToScreen(); }
      else if (e.key === "=" || e.key === "+") { e.preventDefault(); zoomTo(v.zoom * 1.2); }
      else if (e.key === "-") { e.preventDefault(); zoomTo(v.zoom / 1.2); }
      else if (e.key === "0") { e.preventDefault(); v.zoom = 1; v.panX = 0; v.panY = 0; syncDOM(); rerender(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); fitToScreen(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomTo, fitToScreen, rerender, syncDOM]);

  // Touch handlers for mobile pan + pinch-to-zoom
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("[data-id]")) return;
    const touches = e.touches;
    if (touches.length === 1) {
      const v = viewRef.current;
      touchRef.current = { lastDist: 0, lastCenter: { x: touches[0].clientX, y: touches[0].clientY }, panning: true };
      panStartRef.current = { x: touches[0].clientX - v.panX, y: touches[0].clientY - v.panY };
    } else if (touches.length === 2) {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      touchRef.current = {
        lastDist: Math.hypot(dx, dy),
        lastCenter: { x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 },
        panning: false,
      };
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    const v = viewRef.current;
    if (touches.length === 1 && touchRef.current.panning) {
      v.panX = touches[0].clientX - panStartRef.current.x;
      v.panY = touches[0].clientY - panStartRef.current.y;
      syncDOM();
    } else if (touches.length === 2) {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const cx = (touches[0].clientX + touches[1].clientX) / 2;
      const cy = (touches[0].clientY + touches[1].clientY) / 2;
      if (touchRef.current.lastDist > 0) {
        const scale = dist / touchRef.current.lastDist;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          zoomTo(v.zoom * scale, cx - rect.left, cy - rect.top);
        }
      }
      touchRef.current.lastDist = dist;
      touchRef.current.lastCenter = { x: cx, y: cy };
      touchRef.current.panning = false;
    }
  }, [zoomTo, syncDOM]);

  const onTouchEnd = useCallback(() => {
    touchRef.current = { lastDist: 0, lastCenter: { x: 0, y: 0 }, panning: false };
  }, []);

  // Center on selected node (only when selected from sidebar, not from clicking on canvas)
  // If the entity has children, zoom to fit the entity + all children on screen
  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    if (selectedFromCanvasRef.current) {
      selectedFromCanvasRef.current = false;
      return;
    }
    const pos = positions[selectedId];
    if (!pos) return;
    const v = viewRef.current;
    const cw = containerRef.current.offsetWidth;
    const ch = containerRef.current.offsetHeight;

    // Collect selected entity + direct children (via parentId and relationships)
    const familyIds = [selectedId];
    entities.forEach((e) => {
      if (e.parentId === selectedId) familyIds.push(e.id);
    });
    // Also check incoming "isX" relationships (semantic children)
    const sel = entities.find((e) => e.id === selectedId);
    if (sel) {
      (sel.relationships || []).forEach((r) => {
        if (!r.type?.startsWith("is") && positions[r.target]) familyIds.push(r.target);
      });
      entities.forEach((e) => {
        (e.relationships || []).forEach((r) => {
          if (r.target === selectedId && r.type?.startsWith("is") && positions[e.id]) {
            familyIds.push(e.id);
          }
        });
      });
    }

    // Compute bounding box of the family
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of familyIds) {
      const p = positions[id];
      if (!p) continue;
      const s = nodeSizes[id];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + (s?.w ?? 280));
      maxY = Math.max(maxY, p.y + (s?.h ?? 150));
    }

    if (minX === Infinity) return;

    const PADDING = 80;
    const bw = maxX - minX + PADDING * 2;
    const bh = maxY - minY + PADDING * 2;

    // Fit bounding box to screen, but don't zoom in past 1.3
    let nz = Math.min(cw / bw, ch / bh, 1.3);
    nz = Math.max(MIN_ZOOM, nz);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    v.zoom = nz;
    v.panX = cw / 2 - cx * nz;
    v.panY = ch / 2 - cy * nz;
    setAnimating(true);
    rerender();
    setTimeout(() => setAnimating(false), 500);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute entrance animation delays for new entities
  const entranceDelays = useMemo(() => {
    const delays = new Map<string, number>();
    const isLargeDataset = entities.length > 200;
    let newIndex = 0;

    entities.forEach((e) => {
      if (!enteredEntitiesRef.current.has(e.id)) {
        enteredEntitiesRef.current.add(e.id);
        if (isLargeDataset) {
          delays.set(e.id, 0); // all animate simultaneously
        } else {
          // Stagger up to 2s total
          const delay = Math.min(newIndex * 0.05, 2);
          delays.set(e.id, delay);
          newIndex++;
        }
      } else {
        delays.set(e.id, -1); // already entered, skip animation
      }
    });

    return delays;
  }, [entities]);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-bg-primary min-w-0 z-0 isolation-isolate">
      {/* Spotlight gradient — subtle radial glow effect */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(88,166,255,0.03) 0%, transparent 70%)",
        }}
      />

      {/* Viewport */}
      <div
        ref={gridRef}
        className={`absolute inset-0 overflow-hidden ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{
          backgroundImage: "radial-gradient(circle at 0.5px 0.5px, color-mix(in srgb, var(--color-border) 60%, transparent) 0.5px, transparent 0)",
          backgroundSize: `${32 * viewRef.current.zoom}px ${32 * viewRef.current.zoom}px`,
          backgroundPosition: `${viewRef.current.panX}px ${viewRef.current.panY}px`,
        }}
        onWheel={onWheel}
        onMouseDown={onBgMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={transformRef}
          className="absolute top-0 left-0 origin-top-left w-[8000px] h-[8000px]"
          style={{
            transform: `translate(${viewRef.current.panX}px, ${viewRef.current.panY}px) scale(${viewRef.current.zoom})`,
            transition: animating ? "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)" : undefined,
            willChange: "transform",
          }}
        >
          {showEntities && entities.map((e) =>
            renderPositions[e.id] && (!visibleEntityIds || visibleEntityIds.has(e.id)) ? (
              useMiniNodes ? (
                <MiniNode
                  key={e.id}
                  entity={e}
                  position={renderPositions[e.id]}
                  isSelected={selectedId === e.id}
                  onMouseDown={getNodeMouseDown(e.id)}
                  animate={entranceDelays.get(e.id) !== -1}
                />
              ) : (
                <NodeCard
                  key={e.id}
                  entity={e}
                  entities={entities}
                  position={renderPositions[e.id]}
                  isSelected={selectedId === e.id}
                  onMouseDown={getNodeMouseDown(e.id)}
                  enterDelay={entranceDelays.get(e.id) ?? -1}
                  onEnhance={onEnhanceEntity}
                />
              )
            ) : null,
          )}
          {showEntities && <Connections entities={entities} positions={renderPositions} nodeSizes={nodeSizes} selectedId={selectedId} miniMode={useMiniNodes} visibleIds={visibleEntityIds} />}
        </div>
      </div>

      {/* ═══ Scanning in progress — equipment discovery ═══ */}
      {radarActive && (
        <div className={`absolute inset-0 pointer-events-none z-[5] overflow-hidden ${paused ? "animations-paused" : ""}`}>
          {/* Breathing spotlight */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 50%, rgba(88,166,255,0.04) 0%, transparent 60%)",
              animation: "canvas-breathe 4s ease-in-out infinite",
            }}
          />

          {/* Radar sweep rings — expanding from center */}
          {[0, 0.8, 1.6, 2.4].map((delay, i) => (
            <div
              key={`radar-${i}`}
              className="absolute rounded-full border border-accent-blue/30"
              style={{
                width: 80,
                height: 80,
                left: "50%",
                top: "50%",
                marginLeft: -40,
                marginTop: -40,
                animation: `radar-ring 3.2s ease-out ${delay}s infinite`,
              }}
            />
          ))}

          {/* Rotating radar sweep line */}
          <div
            className="absolute"
            style={{
              width: 320,
              height: 320,
              left: "50%",
              top: "50%",
              marginLeft: -160,
              marginTop: -160,
              animation: "radar-sweep 4s linear infinite",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "50%",
                height: 2,
                transformOrigin: "0 50%",
                background: "linear-gradient(90deg, rgba(88,166,255,0.6), transparent)",
              }}
            />
          </div>

          {/* Equipment icons — randomly spawned at varying angles & distances */}
          {equipSpawns.map((sp) => {
            const rad = (sp.angle * Math.PI) / 180;
            const cx = 50 + sp.radius * Math.cos(rad);
            const cy = 50 + sp.radius * Math.sin(rad);
            const color = EQUIP_COLORS[sp.colorIdx];
            const Icon = EQUIP_ICONS[sp.iconIdx];
            return (
              <div key={sp.id}>
                <div
                  className="absolute"
                  style={{
                    left: `${cx}%`,
                    top: `${cy}%`,
                    animation: "equip-cycle 2s ease-in-out forwards",
                    opacity: 0,
                  }}
                >
                  <Icon className="w-8 h-8" style={{ color }} />
                </div>
                <div
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    left: `${cx}%`,
                    top: `${cy}%`,
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                    opacity: 0,
                    animation: "signal-fly 1.5s ease-in 0.3s forwards",
                    offsetPath: `path("M 0,0 L ${((50 - cx) * 6).toFixed(0)},${((50 - cy) * 4).toFixed(0)}")`,
                  }}
                />
              </div>
            );
          })}

        </div>
      )}

      {/* ═══ Premium Empty State Hero ═══ */}
      {(entities.length === 0 || hubVisible) && (
        <>
          {/* Hero logo — single element that animates from hero position to scan center */}
          <div
            className={`absolute left-1/2 z-20 pointer-events-none ${iconScaleIn && scanPhase === "arriving" ? "" : "transition-all duration-1000 ease-in-out"}`}
            style={hubFadingOut ? {
              top: "50%",
              transform: "translate(-50%, -50%) scale(0.5)",
              animation: "hub-fade-out 0.8s ease-in forwards",
            } : hubVisible ? {
              top: "50%",
              transform: "translate(-50%, -50%) scale(0.5)",
              opacity: 1,
              ...(iconScaleIn ? { animation: "hub-scale-in 0.8s ease-out forwards" } : {}),
            } : {
              top: "35%",
              transform: "translate(-50%, -50%) scale(1)",
              opacity: 1,
            }}
          >
            <div
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center relative"
              style={{
                filter: hubVisible ? "drop-shadow(0 0 16px rgba(88,166,255,0.5))" : undefined,
              }}
            >
              <svg viewBox="0 0 24 24" className="w-12 h-12 fill-white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
          </div>

          {/* Fading hero content — anchored below the logo so they never overlap */}
          <div
            className={`absolute left-0 right-0 top-[42%] bottom-0 flex flex-col items-center pt-4 z-10 overflow-hidden transition-all duration-700 ease-out ${hubVisible
              ? "opacity-0 scale-95 blur-sm pointer-events-none"
              : "opacity-100 scale-100 blur-0 animate-in fade-in duration-700"
              }`}
          >
            {/* Ambient gradient orbs */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute w-[400px] h-[400px] rounded-full opacity-30"
                style={{
                  background: "radial-gradient(circle, rgba(88,166,255,0.4) 0%, transparent 70%)",
                  top: "15%",
                  left: "20%",
                  animation: "orb-float-1 18s ease-in-out infinite",
                  filter: "blur(60px)",
                }}
              />
              <div
                className="absolute w-[350px] h-[350px] rounded-full opacity-25"
                style={{
                  background: "radial-gradient(circle, rgba(163,113,247,0.4) 0%, transparent 70%)",
                  top: "50%",
                  right: "15%",
                  animation: "orb-float-2 20s ease-in-out infinite",
                  filter: "blur(60px)",
                }}
              />
              <div
                className="absolute w-[300px] h-[300px] rounded-full opacity-20"
                style={{
                  background: "radial-gradient(circle, rgba(63,185,80,0.3) 0%, transparent 70%)",
                  bottom: "10%",
                  left: "40%",
                  animation: "orb-float-3 15s ease-in-out infinite",
                  filter: "blur(60px)",
                }}
              />
            </div>

            {/* Hero text */}
            <h1
              className="text-4xl md:text-5xl font-bold mb-3 bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-purple))",
              }}
            >
              Open Building Stack
            </h1>
            <p className="text-text-secondary text-lg mb-8 text-center max-w-md px-4">
              Intelligent building network discovery, ontology mapping & AI classification
            </p>

            {/* Glowing CTA button */}
            <button
              onClick={paused ? onResumeScan : onDiscover}
              className="relative px-8 py-3 rounded-xl text-white font-semibold text-base cursor-pointer border-none"
              style={{
                background: "linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-purple))",
                animation: "glow-pulse 2.5s ease-in-out infinite",
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                {paused ? (
                  <Play className="w-5 h-5" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                {paused ? "Resume" : "Discover"}
              </span>
            </button>

            {/* Feature tags */}
            <div className="flex flex-wrap justify-center gap-4 mt-10 px-4">
              {[
                { label: "Auto-Discovery", color: "#58a6ff" },
                { label: "Ontology Mapping", color: "#3fb950" },
                { label: "AI Classification", color: "#a371f7" },
              ].map(({ label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-[13px] text-text-secondary/80 select-none"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!showHero && <Legend sidebarOpen={sidebarOpen} entityCount={entities.length} />}

      {!showHero && (
        <ZoomControls
          zoom={viewRef.current.zoom}
          onZoomIn={() => zoomTo(viewRef.current.zoom * 1.2)}
          onZoomOut={() => zoomTo(viewRef.current.zoom / 1.2)}
          onFit={fitToScreen}
        />
      )}

    </div>
  );
}
