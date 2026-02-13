import { memo } from "react";
import type { Entity, NodePosition } from "../types";
import { getEntityColor, getDisplayName } from "../lib/utils";

interface Props {
  entity: Entity;
  position: NodePosition;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  /** Whether to animate entrance */
  animate?: boolean;
}

/** Lightweight node rendered when zoomed out — just a colored rectangle with a label. */
export const MiniNode = memo(function MiniNode({ entity, position, isSelected, onMouseDown, animate }: Props) {
  const color = getEntityColor(entity.type);
  return (
    <div
      data-id={entity.id}
      onMouseDown={onMouseDown}
      className="absolute rounded cursor-move"
      style={{
        left: position.x,
        top: position.y,
        width: 200,
        height: 48,
        background: color + "22",
        border: `2px solid ${color}`,
        boxShadow: isSelected ? `0 0 0 3px ${color}` : undefined,
        zIndex: isSelected ? 20 : 1,
        overflow: "hidden",
        padding: "4px 8px",
        ...(animate ? { animation: "mini-node-enter 0.3s ease-out both" } : {}),
      }}
    >
      <div
        className="text-[11px] font-semibold text-text-primary truncate leading-tight"
        style={{ lineHeight: "20px" }}
      >
        {getDisplayName(entity)}
      </div>
      <div className="text-[9px] uppercase font-semibold truncate" style={{ color }}>
        {entity.type}
      </div>
    </div>
  );
});
