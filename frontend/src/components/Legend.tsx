import { useState } from "react";
import { getEntityColorMap, getRelationColorMap } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";

interface LegendProps {
  sidebarOpen?: boolean;
  entityCount?: number;
}

export function Legend({ sidebarOpen, entityCount = 0 }: LegendProps) {
  const entityColors = getEntityColorMap();
  const relColors = getRelationColorMap();
  const [expanded, setExpanded] = useState(false);

  if (entityCount === 0 || (entityColors.size === 0 && relColors.size === 0)) return null;

  // On mobile, shift right when sidebar is open (sidebar is w-80 max-w-[85vw])
  const mobileLeft = sidebarOpen
    ? "left-[calc(min(85vw,20rem)+1rem)]"
    : "left-4";

  return (
    <>
      {/* Mobile: small toggle button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setExpanded((v) => !v)}
        className={`md:hidden absolute bottom-4 ${mobileLeft} z-40 bg-bg-secondary/80 backdrop-blur-md transition-[left] duration-300 ease-in-out md:left-4`}
        aria-label="Toggle legend"
      >
        <Info />
      </Button>

      {/* Legend panel — glassmorphism + entry animation */}
      <div
        className={[
          `absolute bottom-4 ${mobileLeft} bg-bg-secondary/80 backdrop-blur-md border border-white/5 rounded-md p-2.5 text-[11px] z-40 max-w-[300px]`,
          "transition-[left] duration-300 ease-in-out md:left-4",
          "animate-in fade-in slide-in-from-bottom-4 duration-300",
          expanded ? "block" : "hidden",
          "md:block",
        ].join(" ")}
      >
        {entityColors.size > 0 && (
          <div className="mb-2">
            <div className="font-semibold text-text-primary mb-1.5 text-[10px] uppercase">Entity Types</div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-1.5">
              {[...entityColors].map(([type, color]) => (
                <div key={type} className="flex items-center gap-1 text-text-secondary">
                  <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
                  {type}
                </div>
              ))}
            </div>
          </div>
        )}
        {relColors.size > 0 && (
          <div>
            <div className="font-semibold text-text-primary mb-1.5 text-[10px] uppercase">Relationships</div>
            <div className="flex flex-wrap gap-x-2.5 gap-y-1.5">
              {[...relColors].map(([type, color]) => (
                <div key={type} className="flex items-center gap-1 text-text-secondary">
                  <span className="w-5 h-0.5 rounded-sm" style={{ background: color }} />
                  {type}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Close on mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(false)}
          className="md:hidden absolute top-0.5 right-0.5 h-6 w-6"
          aria-label="Close legend"
        >
          <X />
        </Button>
      </div>
    </>
  );
}
