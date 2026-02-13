import { Button } from "@/components/ui/button";
import { Plus, Minus, Maximize } from "lucide-react";

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onFit }: Props) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-50 rounded-xl bg-bg-secondary/80 backdrop-blur-sm border border-white/5 p-1">
      <Button variant="outline" size="icon" onClick={onZoomIn} title="Zoom in (+)" className="bg-transparent border-none"><Plus className="h-4 w-4" /></Button>
      <Button variant="outline" size="icon" onClick={onZoomOut} title="Zoom out (-)" className="bg-transparent border-none"><Minus className="h-4 w-4" /></Button>
      <div className="w-9 py-1 text-[10px] text-center text-text-secondary">
        {Math.round(zoom * 100)}%
      </div>
      <Button variant="outline" size="icon" onClick={onFit} title="Fit to screen (F)" className="bg-transparent border-none"><Maximize className="h-4 w-4" /></Button>
    </div>
  );
}
