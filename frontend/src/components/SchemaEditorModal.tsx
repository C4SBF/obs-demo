import { useState, useCallback, useMemo } from "react";
import yaml from "js-yaml";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { YamlEditor } from "./YamlEditor";


type ViewMode = "raw" | "classified";

interface Props {
  data: Record<string, unknown>;
  rawData?: Record<string, unknown> | null;
  hasClassified?: boolean;
  onApply: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

function toYaml(data: Record<string, unknown>): string {
  return Object.keys(data).length === 0
    ? ""
    : yaml.dump(data, { sortKeys: false, noRefs: true });
}

/* ── Modal ───────────────────────────────────────────────────────────────── */

export function SchemaEditorModal({ data, rawData, hasClassified, onApply, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const showToggle = hasClassified && rawData != null;
  const [mode, setMode] = useState<ViewMode>(showToggle ? "classified" : "raw");

  // Keep separate state values so switching modes preserves edits
  const initialClassified = useMemo(() => toYaml(data), [data]);
  const initialRaw = useMemo(() => rawData ? toYaml(rawData) : "", [rawData]);
  const [classifiedValue, setClassifiedValue] = useState(initialClassified);
  const [rawValue, setRawValue] = useState(initialRaw);

  const activeValue = mode === "classified" ? classifiedValue : rawValue;

  const handleChange = useCallback((val: string) => {
    if (mode === "classified") setClassifiedValue(val);
    else setRawValue(val);
    setError(null);
  }, [mode]);

  const handleApply = useCallback(() => {
    const text = activeValue;
    try {
      const raw = yaml.load(text.trim() || "{}");
      const parsed = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      setError(null);
      onApply(parsed);
    } catch (e: unknown) {
      setError(String(e));
    }
  }, [onApply, activeValue]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[1280px] w-[95vw] h-[85vh] flex flex-col bg-bg-secondary">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-sm">Schema Editor (YAML)</DialogTitle>
            {showToggle && (
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  onClick={() => setMode("raw")}
                  className={`px-3 py-1 transition-colors ${
                    mode === "raw"
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-text-secondary hover:bg-bg-tertiary"
                  }`}
                >
                  Raw
                </button>
                <button
                  onClick={() => setMode("classified")}
                  className={`px-3 py-1 transition-colors border-l border-border ${
                    mode === "classified"
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-text-secondary hover:bg-bg-tertiary"
                  }`}
                >
                  Classified
                </button>
              </div>
            )}
          </div>
          <DialogDescription className="sr-only">
            Edit discovery schema in YAML format
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 overflow-hidden rounded border border-border">
          <YamlEditor
            key={mode}
            value={activeValue}
            onChange={handleChange}
            autoFocus
          />
        </div>

        {error && (
          <div className="text-xs text-accent-red">{error}</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
