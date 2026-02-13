export interface RelationshipData {
  type: string;
  target: string;
}

export interface EntityMeta {
  manufacturer?: string;
  model?: string;
  address?: string;
  firmware?: string;
  description?: string;
  units?: string;
  data_type?: string;
  name?: string;
  [key: string]: string | undefined;
}

export interface AiDiffEntry {
  field: string;
  ruleBased: string;
  ai: string;
}

export interface Entity {
  id: string;
  type: string;
  name?: string;
  description?: string;
  class?: string;
  tags: string[];
  relationships: RelationshipData[];
  meta: EntityMeta;
  /** Set for nodes extracted from nested arrays (e.g. points inside devices) */
  parentId?: string;
  /** True if AI classification changed this entity vs rule-based */
  aiEnhanced?: boolean;
  /** All differing values between rule-based and AI */
  aiDiff?: AiDiffEntry[];
  /** True if entity has classification candidates (even if no class selected) */
  hasCandidates?: boolean;
}

export interface OntologyInfo {
  id: string;
  name: string;
  version?: string;
  url?: string;
}

/** Census data from /discover (Level 1) */
export interface DeviceCensus {
  device_address: string;
  device_id: number;
  device_name: string | null;
  vendor: string | null;
  object_count?: number;
}

/** Raw device returned by /discover or /discover/all */
export type DeviceData = Record<string, unknown>;

/** Semantic format from /classify (with ontology) */
export interface ClassifiedData {
  ontology?: { name?: string; version?: string };
  entities: Entity[];
  stats?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NodePosition {
  x: number;
  y: number;
}
