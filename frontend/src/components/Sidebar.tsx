import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Entity } from "../types";
import { getEntityColor, hexToRgba, getDisplayName } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EntityTooltip } from "./EntityTooltip";
import { X } from "lucide-react";

interface Props {
  entities: Entity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Mobile drawer open state */
  open?: boolean;
  /** Close the mobile drawer */
  onClose?: () => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;
const COLLAPSED_KEY = "obs-sidebar-collapsed";

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveCollapsed(set: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
  } catch { /* ignore quota errors */ }
}

interface FlatRow {
  entity: Entity;
  depth: number;
}

export function Sidebar({ entities, selectedId, onSelect, open, onClose }: Props) {
  const [collapsed, _setCollapsed] = useState<Set<string>>(loadCollapsed);
  const setCollapsed = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    _setCollapsed((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveCollapsed(next);
      return next;
    });
  }, []);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const draggingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build parent-child tree from parentId (standard format) or relationships (semantic)
  const { roots, childrenMap, parentOf } = useMemo(() => {
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    const cm = new Map<string, Entity[]>();
    const parentOf = new Map<string, string>();
    entities.forEach((e) => cm.set(e.id, []));

    entities.forEach((e) => {
      // Prefer explicit parentId (set by generic walker for nested arrays)
      if (e.parentId && entityMap.has(e.parentId) && !parentOf.has(e.id)) {
        parentOf.set(e.id, e.parentId);
        cm.get(e.parentId)!.push(e);
        return;
      }
      // Fall back to relationships (semantic format: isPartOf/isPointOf = child→parent)
      (e.relationships || []).forEach((rel) => {
        if (!entityMap.has(rel.target)) return;
        const isChildOf = rel.type?.startsWith("is");
        const parentId = isChildOf ? rel.target : e.id;
        const childId = isChildOf ? e.id : rel.target;
        if (!parentOf.has(childId)) {
          parentOf.set(childId, parentId);
          cm.get(parentId)!.push(entityMap.get(childId)!);
        }
      });
    });

    return { roots: entities.filter((e) => !parentOf.has(e.id)), childrenMap: cm, parentOf };
  }, [entities]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [setCollapsed]);

  // When selectedId changes, expand ancestors and scroll into view
  useEffect(() => {
    if (!selectedId) return;
    // Expand all ancestors so the item is visible
    const ancestors: string[] = [];
    let cur = parentOf.get(selectedId);
    while (cur) {
      ancestors.push(cur);
      cur = parentOf.get(cur);
    }
    if (ancestors.length > 0) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        ancestors.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [selectedId, parentOf]);

  // Flatten the visible tree (respecting collapsed state) into an array
  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    const walk = (list: Entity[], depth: number) => {
      for (const entity of list) {
        rows.push({ entity, depth });
        const children = childrenMap.get(entity.id) || [];
        if (children.length > 0 && !collapsed.has(entity.id)) {
          walk(children, depth + 1);
        }
      }
    };
    walk(roots, 0);
    return rows;
  }, [roots, childrenMap, collapsed]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 20,
  });

  // Scroll to selected entity after ancestors are expanded
  useEffect(() => {
    if (!selectedId) return;
    requestAnimationFrame(() => {
      const idx = flatRows.findIndex((r) => r.entity.id === selectedId);
      if (idx >= 0) {
        virtualizer.scrollToIndex(idx, { align: "auto", behavior: "smooth" });
      }
    });
  }, [selectedId, flatRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize drag handle (desktop only)
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + ev.clientX - startX));
      setWidth(newW);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  const allCollapsed = roots.every((r) => collapsed.has(r.id));

  const toggleAll = useCallback(() => {
    if (allCollapsed) {
      setCollapsed(new Set());
    } else {
      const all = new Set<string>();
      const addAll = (e: Entity) => {
        if ((childrenMap.get(e.id) || []).length > 0) {
          all.add(e.id);
          childrenMap.get(e.id)!.forEach(addAll);
        }
      };
      roots.forEach(addAll);
      setCollapsed(all);
    }
  }, [allCollapsed, roots, childrenMap]);

  return (
    <>
      <aside
        className={[
          "bg-bg-secondary/80 backdrop-blur-xl border-r border-white/5 shrink-0 flex flex-col overflow-hidden z-50",
          // Mobile: overlay + slide via transform
          "absolute inset-y-0 left-0 w-80 max-w-[85vw] transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: back in flow, always visible
          "md:relative md:inset-auto md:!translate-x-0 md:transition-none md:max-w-none md:!w-[var(--sb-w)]",
          // Layer promotion
          "transform-gpu will-change-transform",
        ].join(" ")}
        style={{ "--sb-w": `${width}px` } as React.CSSProperties}
      >
        <div className="px-4 py-3 border-b border-border flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 font-semibold text-sm">
            Entities
            <Badge variant="secondary" className="rounded-full">
              {entities.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {entities.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleAll} className="text-[11px]">
                {allCollapsed ? "Expand All" : "Collapse All"}
              </Button>
            )}
            {/* Close button — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="md:hidden text-text-secondary"
              aria-label="Close sidebar"
            >
              <X />
            </Button>
          </div>
        </div>

        {entities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-text-secondary text-sm py-8">
            No entities yet found
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-auto sidebar-scroll-fade">
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const { entity, depth } = flatRows[virtualRow.index];
                const children = childrenMap.get(entity.id) || [];
                const hasChildren = children.length > 0;
                const isCollapsed = collapsed.has(entity.id);
                const color = getEntityColor(entity.type);
                const isSelected = selectedId === entity.id;

                return (
                  <div
                    key={entity.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="absolute left-0 w-full px-2"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <EntityTooltip entity={entity} entities={entities}>
                      <div
                        data-sidebar-id={entity.id}
                        onClick={() => onSelect(entity.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 border-l-2 ${isSelected ? "ring-1 ring-inset" : "hover:!bg-[image:var(--hover-bg)] hover:!border-l-[color:var(--hover-border)]"} ${isSelected ? "" : "border-l-transparent"}`}
                        style={{
                          marginLeft: depth * 16,
                          "--hover-bg": `linear-gradient(90deg, ${hexToRgba(color, 0.15)}, transparent)`,
                          "--hover-border": color,
                          background: isSelected ? `linear-gradient(90deg, ${hexToRgba(color, 0.15)}, transparent)` : undefined,
                          borderLeftColor: isSelected ? color : undefined,
                          ["--tw-ring-color" as string]: isSelected ? hexToRgba(color, 0.3) : undefined,
                        } as React.CSSProperties}
                      >
                        <span
                          onClick={(e) => { e.stopPropagation(); toggle(entity.id); }}
                          className={`w-4 h-4 flex items-center justify-center text-text-secondary text-[10px] shrink-0 transition-transform duration-200 cursor-pointer ${isCollapsed ? "-rotate-90" : ""} ${!hasChildren ? "invisible" : ""}`}
                        >
                          &#9660;
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="text-xs font-medium break-words leading-tight">
                            {getDisplayName(entity)}
                            {entity.aiEnhanced && <span className="ml-1 text-yellow-300 text-xs drop-shadow-[0_0_4px_rgba(253,224,71,0.8)]">✦</span>}
                          </div>
                          {entity.description && entity.description !== getDisplayName(entity) && (
                            <div className="text-[10px] text-text-secondary truncate mt-0.5">
                              {entity.description}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="inline-block text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold"
                              style={{ background: hexToRgba(color, 0.15), color }}
                            >
                              {entity.type}
                            </span>
                            {hasChildren && (
                              <span className="text-[9px] text-text-secondary">
                                {children.length}
                              </span>
                            )}
                            {entity.class && entity.class !== "unknown" && (
                              <span className="text-[9px] text-accent-purple truncate">
                                {entity.class.includes(".") ? entity.class.split(".").pop() : entity.class}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </EntityTooltip>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resize handle — desktop only */}
        <div
          onMouseDown={onResizeStart}
          className="hidden md:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent-blue/40 active:bg-accent-blue/60 transition-colors"
        />
      </aside>
    </>
  );
}
