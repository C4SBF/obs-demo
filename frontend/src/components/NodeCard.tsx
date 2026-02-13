import { memo, useState } from "react";
import type { Entity, NodePosition } from "../types";
import { getEntityColor, hexToRgba, getDisplayName } from "../lib/utils";
import { EntityTooltip } from "./EntityTooltip";
import { Wand2, Diamond } from "lucide-react";

interface Props {
  entity: Entity;
  entities: Entity[];
  position: NodePosition;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  /** Staggered entrance delay (seconds). -1 = skip animation. */
  enterDelay?: number;
  /** Callback to enhance this entity individually */
  onEnhance?: (entityId: string) => Promise<void>;
}

export const NodeCard = memo(function NodeCard({ entity, entities, position, isSelected, onMouseDown, enterDelay = 0, onEnhance }: Props) {
  const color = getEntityColor(entity.type);
  const displayName = getDisplayName(entity);
  const rels = entity.relationships || [];
  const [enhancing, setEnhancing] = useState(false);

  const handleEnhanceClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onEnhance || enhancing) return;
    setEnhancing(true);
    try {
      await onEnhance(entity.id);
    } finally {
      setEnhancing(false);
    }
  };

  // Show enhance button if entity is classified OR has candidates, but not already AI-enhanced
  const showEnhanceButton = (entity.class || entity.hasCandidates) && !entity.aiEnhanced && onEnhance;

  // Entrance animation style (transform/opacity) -> applied to wrapper
  const entranceStyle: React.CSSProperties = enterDelay >= 0
    ? {
      animation: `node-enter 0.5s ease-out ${enterDelay}s both`,
    }
    : {};

  // Ambient glow for all nodes
  const ambientGlow = `0 0 12px ${hexToRgba(color, 0.15)}`;

  // Selection ring animation -> applied to inner card
  const selectionStyle: React.CSSProperties = isSelected
    ? {
      "--ring-color": color,
      "--glow-color": hexToRgba(color, 0.5),
      animation: `selection-ring-expand 0.4s ease-out forwards`,
    } as React.CSSProperties
    : {};

  return (
    <EntityTooltip entity={entity} entities={entities}>
      <div
        data-id={entity.id}
        className="absolute min-w-[180px] max-w-[260px] group"
        style={{
          left: position.x,
          top: position.y,
          zIndex: isSelected ? 20 : 1,
          ...entranceStyle,
        }}
      >
        <div
          onMouseDown={onMouseDown}
          className="rounded-lg p-2.5 px-3 cursor-move w-full h-full transition-all duration-150 hover:![background:var(--card-hover-bg)]"
          style={{
            "--card-bg": "var(--color-bg-secondary)",
            "--card-hover-bg": `linear-gradient(90deg, ${hexToRgba(color, 0.15)}, transparent), var(--color-bg-secondary)`,
            background: "var(--card-bg)",
            border: `2px solid ${color}`,
            boxShadow: isSelected
              ? `0 0 0 4px ${color}, 0 0 20px ${hexToRgba(color, 0.5)}`
              : ambientGlow,
            ...selectionStyle,
          } as React.CSSProperties}
        >
          {/* Header: name + type badge + enhance button */}
          <div className="flex justify-between items-start gap-2">
            <div className="text-[12px] font-semibold break-all leading-tight truncate flex-1">
              {displayName}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {entity.aiEnhanced ? (
                <span>
                  <Diamond
                    className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.9)]"
                    style={{ filter: "drop-shadow(0 0 4px rgba(250,204,21,0.6))" }}
                  />
                </span>
              ) : showEnhanceButton ? (
                <button
                  onClick={handleEnhanceClick}
                  disabled={enhancing}
                  className="p-0.5 rounded hover:bg-accent-purple/20 text-text-secondary hover:text-accent-purple transition-colors disabled:opacity-50"

                >
                  <Wand2 className={`w-3 h-3 ${enhancing ? "animate-pulse text-accent-purple" : ""}`} />
                </button>
              ) : null}
              <span
                className="text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold whitespace-nowrap"
                style={{ background: hexToRgba(color, 0.2), color }}
              >
                {entity.type}
              </span>
            </div>
          </div>

          {/* Description subtitle */}
          {entity.description && entity.description !== displayName && (
            <div className="text-[10px] text-text-secondary mt-0.5 truncate">
              {entity.description}
            </div>
          )}

          {/* Minimal subtitle: class or relation count */}
          {entity.class && entity.class !== "unknown" ? (
            <div className="text-[10px] text-accent-purple mt-1 truncate">
              {entity.class.includes(".") ? entity.class.split(".").pop() : entity.class}
            </div>
          ) : rels.length > 0 ? (
            <div className="text-[10px] text-text-secondary mt-1">{rels.length} relation{rels.length > 1 ? "s" : ""}</div>
          ) : null}
        </div>
      </div>
    </EntityTooltip>
  );
});
