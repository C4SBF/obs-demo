import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Color palette for dynamic type assignment */
const PALETTE = [
  "#238636", "#1f6feb", "#a371f7", "#d29922", "#f85149",
  "#3fb950", "#58a6ff", "#bc8cff", "#e3b341", "#ff7b72",
  "#2ea043", "#388bfd", "#8b5cf6", "#f0883e", "#da3633",
];

const entityColorMap = new Map<string, string>();
const relationColorMap = new Map<string, string>();

export function getEntityColor(type: string): string {
  if (!entityColorMap.has(type)) {
    entityColorMap.set(type, PALETTE[entityColorMap.size % PALETTE.length]);
  }
  return entityColorMap.get(type)!;
}

export function getRelationColor(type: string): string {
  if (!relationColorMap.has(type)) {
    relationColorMap.set(type, PALETTE[(relationColorMap.size + 5) % PALETTE.length]);
  }
  return relationColorMap.get(type)!;
}

export function resetColorMaps() {
  entityColorMap.clear();
  relationColorMap.clear();
}

export function getEntityColorMap() {
  return entityColorMap;
}

export function getRelationColorMap() {
  return relationColorMap;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function truncate(s: string, len: number): string {
  return s.length > len ? s.substring(0, len) + "..." : s;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(s: string): boolean {
  return UUID_RE.test(s);
}

export function getDisplayName(entity: { id: string; name?: string; description?: string; meta?: Record<string, unknown> }): string {
  if (entity.name) return truncate(entity.name, 40);
  const m = entity.meta || {};
  if (m.name) return truncate(String(m.name), 40);
  if (entity.description) return truncate(entity.description, 40);
  if (m.description) return truncate(String(m.description), 40);
  if (isUUID(entity.id)) return entity.id.substring(0, 8) + "...";
  return entity.id.length > 40
    ? entity.id.substring(0, 20) + "..." + entity.id.substring(entity.id.length - 16)
    : entity.id;
}
