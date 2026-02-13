import { useRef, useState, useCallback, useEffect, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Entity } from "../types";
import { getEntityColor, getDisplayName, isUUID, truncate } from "../lib/utils";

const DELAY = 400;

interface Props {
  entity: Entity;
  entities?: Entity[];
  children: ReactNode;
}

export function EntityTooltip({ entity, entities, children }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const mouseRef = useRef({ x: 0, y: 0 });

  const trackMouse = useCallback((e: React.MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const show = useCallback((e: React.MouseEvent) => {
    cancel();
    mouseRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = setTimeout(() => {
      setAdjustedPos(null);
      setPos({ x: mouseRef.current.x + 12, y: mouseRef.current.y + 12 });
      setVisible(true);
    }, DELAY);
  }, [cancel]);

  // After tooltip renders, measure it and reposition to fit on screen
  // Using requestAnimationFrame to schedule the state update outside the effect body
  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let x = pos.x;
    let y = pos.y;

    // Flip left if overflowing right
    if (x + rect.width > window.innerWidth - pad) {
      x = Math.max(pad, pos.x - rect.width - 24);
    }
    // Flip above cursor if overflowing bottom
    if (y + rect.height > window.innerHeight - pad) {
      y = Math.max(pad, pos.y - rect.height - 24);
    }

    if (x !== pos.x || y !== pos.y) {
      // Schedule state update outside effect to avoid lint warning
      requestAnimationFrame(() => setAdjustedPos({ x, y }));
    }
  }, [visible, pos]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const color = getEntityColor(entity.type);
  const m = entity.meta || {};
  const tags = entity.tags || [];
  const rels = entity.relationships || [];

  const entityMap = entities ? new Map(entities.map((e) => [e.id, e])) : null;
  const targetLabel = (targetId: string) => {
    if (entityMap) {
      const target = entityMap.get(targetId);
      if (target) return truncate(getDisplayName(target), 40);
    }
    return truncate(targetId, 40);
  };

  // Check if there's any extended info to show
  const hasName = !!entity.name;
  const hasDesc = !!entity.description;
  const hasClass = entity.class && entity.class !== "unknown";
  const hasId = isUUID(entity.id);
  const hasMeta = Object.keys(m).length > 0;
  const hasTags = tags.length > 0;
  const hasRels = rels.length > 0;
  const hasAiDiff = entity.aiDiff && entity.aiDiff.length > 0;
  const hasContent = hasName || hasDesc || hasClass || hasId || hasMeta || hasTags || hasRels || hasAiDiff;

  if (!hasContent) {
    return <>{children}</>;
  }

  const stringify = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const renderMetaValue = (key: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Format confidence values as percentages
    if (key === "class_confidence" || key === "confidence") {
      const num = parseFloat(trimmed);
      if (!isNaN(num)) {
        return <span className="text-text-primary">{(num * 100).toFixed(0)}%</span>;
      }
    }

    // Show LLM reasoning in full
    if (key === "llm_reasoning") {
      return <span className="text-text-primary whitespace-pre-wrap">{value}</span>;
    }

    if (!((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))) {
      return <span className="text-text-primary">{truncate(value, 80)}</span>;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;

      // Special handling for class_candidates - show class name with confidence % and evidence
      if (key === "class_candidates" && Array.isArray(parsed)) {
        if (parsed.length === 0) return <span className="text-text-primary">[]</span>;
        return (
          <ul className="mt-0.5 ml-3 list-disc text-text-primary">
            {parsed.slice(0, 5).map((item, i) => {
              const candidate = item as Record<string, unknown>;
              const className = String(candidate.class ?? "");
              const confidence = Number(candidate.confidence ?? 0);
              const pct = (confidence * 100).toFixed(1);
              const evidence = Array.isArray(candidate.evidence) ? candidate.evidence as string[] : [];
              return (
                <li key={i} className="mb-1">
                  <span className="text-accent-purple">{className.replace(/^brick:/, "")}</span>
                  <span className="text-text-secondary ml-1">({pct}%)</span>
                  {evidence.length > 0 && (
                    <div className="text-[10px] text-text-secondary ml-2 italic">
                      {evidence.slice(0, 3).join(", ")}{evidence.length > 3 ? "..." : ""}
                    </div>
                  )}
                </li>
              );
            })}
            {parsed.length > 5 ? <li className="text-text-secondary">+{parsed.length - 5} more</li> : null}
          </ul>
        );
      }

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>);
        if (entries.length === 0) return <span className="text-text-primary">{ }</span>;
        return (
          <ul className="mt-0.5 ml-3 list-disc text-text-primary">
            {entries.map(([k, v]) => (
              <li key={k}>
                <span className="text-text-secondary">{k}</span>: {truncate(stringify(v), 80)}
              </li>
            ))}
          </ul>
        );
      }
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return <span className="text-text-primary">[]</span>;
        return (
          <ul className="mt-0.5 ml-3 list-disc text-text-primary">
            {parsed.slice(0, 8).map((item, i) => (
              <li key={i}>{truncate(stringify(item), 80)}</li>
            ))}
            {parsed.length > 8 ? <li>... +{parsed.length - 8} more</li> : null}
          </ul>
        );
      }
      return <span className="text-text-primary">{truncate(stringify(parsed), 80)}</span>;
    } catch {
      return <span className="text-text-primary">{truncate(value, 80)}</span>;
    }
  };

  return (
    <div onMouseEnter={show} onMouseMove={trackMouse} onMouseLeave={cancel} onMouseDown={cancel} className="contents">
      {children}
      {visible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] rounded-lg p-3 px-4 min-w-[220px] max-w-[420px] shadow-lg border border-border pointer-events-none animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150"
          style={{
            left: (adjustedPos ?? pos).x,
            top: (adjustedPos ?? pos).y,
            background: "var(--color-bg-secondary)",
            borderLeft: `3px solid ${color}`,
          }}
        >
          {/* Name (full, untruncated) */}
          {hasName && (
            <div className="text-[12px] font-semibold text-text-primary mb-0.5">{entity.name}</div>
          )}

          {/* Description */}
          {hasDesc && (
            <div className="text-[11px] text-text-secondary mb-1.5">{entity.description}</div>
          )}

          {/* Class — only if not already shown on card (card shows class OR rel count) */}
          {hasClass && (
            <div className="text-[11px] text-accent-purple mb-1.5 break-all">{entity.class}</div>
          )}

          {/* Full ID */}
          {hasId && (
            <div className="text-[11px] text-text-secondary mb-1">
              id: <span className="text-text-primary font-mono text-[10px]">{entity.id}</span>
            </div>
          )}

          {/* Meta fields */}
          {hasMeta && (
            <div className="text-[11px] text-text-secondary">
              {Object.entries(m).map(([k, v]) =>
                v ? (
                  <div key={k} className="mt-1">
                    {k}: {renderMetaValue(k, String(v))}
                  </div>
                ) : null,
              )}
            </div>
          )}

          {/* Tags */}
          {hasTags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary rounded text-accent-orange">{t}</span>
              ))}
            </div>
          )}

          {/* Relationships — first 10 with resolved names */}
          {hasRels && (
            <div className="mt-2 pt-2 border-t border-border text-[11px] text-text-secondary">
              {rels.slice(0, 10).map((r, i) => (
                <div key={i} className="mt-0.5">
                  <span className="text-text-primary">{r.type}</span> → <span className="text-text-primary">{targetLabel(r.target)}</span>
                </div>
              ))}
              {rels.length > 10 && (
                <div className="mt-1 text-[10px] italic">+{rels.length - 10} more</div>
              )}
            </div>
          )}

          {/* AI Enhancement comparison */}
          {hasAiDiff && (
            <div className="mt-2 pt-2 border-t border-accent-purple/30 text-[11px]">
              <div className="text-accent-purple font-medium mb-1.5">✦ AI Enhanced</div>
              <div className="flex flex-col gap-1.5">
                {entity.aiDiff!.map((d) => (
                  <div key={d.field} className="break-all">
                    <div className="text-text-secondary">{d.field}:</div>
                    <div className="text-text-primary line-through opacity-60">{d.ruleBased}</div>
                    <div className="text-accent-purple">{d.ai}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
