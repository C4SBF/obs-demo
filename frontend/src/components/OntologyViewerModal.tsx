import { useEffect, useState } from "react";
import yaml from "js-yaml";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { YamlEditor } from "./YamlEditor";
import * as api from "../api";

interface Props {
  ontologyId: string;
  onClose: () => void;
}

export function OntologyViewerModal({ ontologyId, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getOntology(ontologyId).then((data) => {
      setContent(yaml.dump(data, { sortKeys: false, noRefs: true }));
    }).catch((e) => {
      setError(`Error: ${e.message}`);
    });
  }, [ontologyId]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[1280px] w-[95vw] h-[85vh] flex flex-col bg-bg-secondary">
        <DialogHeader>
          <DialogTitle className="text-sm">Ontology: {ontologyId}</DialogTitle>
          <DialogDescription className="sr-only">
            View ontology definition in YAML format
          </DialogDescription>
        </DialogHeader>
        <div className="relative flex-1 overflow-hidden rounded border border-border">
          {error ? (
            <div className="p-3 text-accent-red text-sm">{error}</div>
          ) : content ? (
            <YamlEditor value={content} editable={false} />
          ) : (
            <div className="p-3 text-text-secondary text-sm">Loading...</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
