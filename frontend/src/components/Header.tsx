declare const __VERSION__: string;
declare const __DEMO__: boolean;

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { OntologyInfo } from "../types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Menu, Trash2, Pencil, Pause, Play, Search, Eye, Sparkles, Wand2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  ontologies: OntologyInfo[];
  selectedOntology: string | null;
  onSelectOntology: (id: string | null) => void;
  onViewOntology: () => void;
  onClassify: () => void;
  classifying?: boolean;
  classificationCompleted?: boolean;
  onEnhance?: () => void;
  enhancing?: boolean;
  aiAvailable?: boolean;
  hasClassifiedData?: boolean;
  onDiscover: () => void;
  onSchemaEdit: () => void;
  discovering: boolean;
  scanning?: boolean;
  paused?: boolean;
  scanProgress?: { done: number; total: number } | null;
  onToggleSidebar: () => void;
  onPauseScan?: () => void;
  onResumeScan?: () => void;
  hasData?: boolean;
  onClearData?: () => void;
}

type DiscoveryPhase = "idle" | "census" | "scan";

function RadarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ animation: "radar-sweep 2s linear infinite" }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <path d="M12 2 A10 10 0 0 1 22 12" fill="rgba(88,166,255,0.3)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function EqualizerIcon() {
  return (
    <div className="flex items-end gap-[2px] h-4 w-4">
      <div
        className="w-[3px] bg-accent-blue rounded-sm"
        style={{ animation: "eq-bar-1 0.8s ease-in-out infinite", height: "40%" }}
      />
      <div
        className="w-[3px] bg-accent-blue rounded-sm"
        style={{ animation: "eq-bar-2 0.8s ease-in-out infinite 0.15s", height: "60%" }}
      />
      <div
        className="w-[3px] bg-accent-blue rounded-sm"
        style={{ animation: "eq-bar-3 0.8s ease-in-out infinite 0.3s", height: "30%" }}
      />
    </div>
  );
}

function CelebrationDots() {
  const dots = [
    { color: "#58a6ff", x: "-30px", y: "-30px" },
    { color: "#a371f7", x: "30px", y: "-25px" },
    { color: "#3fb950", x: "-25px", y: "30px" },
    { color: "#d29922", x: "25px", y: "25px" },
    { color: "#f85149", x: "-35px", y: "5px" },
    { color: "#58a6ff", x: "35px", y: "-5px" },
    { color: "#a371f7", x: "-10px", y: "-35px" },
    { color: "#3fb950", x: "10px", y: "35px" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {dots.map((dot, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: dot.color,
            "--burst-x": dot.x,
            "--burst-y": dot.y,
            animation: `celebration-burst 0.8s ease-out ${i * 0.05}s forwards`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function Tip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Header({
  ontologies,
  selectedOntology,
  onSelectOntology,
  onViewOntology,
  onClassify,
  classifying,
  classificationCompleted,
  onEnhance,
  enhancing,
  aiAvailable,
  hasClassifiedData,
  onDiscover,
  onSchemaEdit,
  discovering,
  scanning,
  paused,
  scanProgress,
  onToggleSidebar,
  onPauseScan,
  onResumeScan,
  hasData,
  onClearData,
}: Props) {
  const progressPct = scanProgress ? (scanProgress.done / scanProgress.total) * 100 : 0;
  const showProgress = discovering || !!scanProgress || classifying || enhancing;
  const currentPhase: DiscoveryPhase = discovering ? "census" : (scanning || !!scanProgress) ? "scan" : (classifying || enhancing) ? "census" : "idle";
  const prevPhaseRef = useRef<DiscoveryPhase>("idle");
  const [showCelebration, setShowCelebration] = useState(false);

  const celebTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev !== currentPhase) {
      if (prev === "scan" && currentPhase === "idle" && hasData) {
        // Schedule state update outside effect body
        requestAnimationFrame(() => setShowCelebration(true));
        clearTimeout(celebTimerRef.current);
        celebTimerRef.current = setTimeout(() => setShowCelebration(false), 1000);
      }
      prevPhaseRef.current = currentPhase;
    }
    return () => clearTimeout(celebTimerRef.current);
  }, [currentPhase, hasData]);

  return (
    <header className="bg-bg-secondary/80 backdrop-blur-xl border-b border-white/5 shrink-0 z-50 relative">
      <div className="flex items-center gap-2 px-3 py-2 md:gap-6 md:px-5 md:py-3 md:min-h-14">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="md:hidden text-text-secondary"
          aria-label="Toggle sidebar"
        >
          <Menu />
        </Button>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center transition-transform duration-200 hover:scale-105"
            style={{ animation: "glow-pulse 3s ease-in-out infinite" }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">Open Building Stack <span className="hidden md:inline">Playground</span></div>
            <div className="text-[11px] text-text-secondary">Discovery <span className="text-text-secondary/50">v{__VERSION__}</span></div>
          </div>
        </div>

        <Separator orientation="vertical" className="h-6 hidden md:block" />

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Topology</span>
          <Select
            value={selectedOntology || "__none__"}
            onValueChange={(v) => onSelectOntology(v === "__none__" ? null : v)}
          >
            <SelectTrigger className="w-[220px] bg-bg-tertiary border-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {ontologies.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}{o.version ? ` v${o.version}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tip label="Preview ontology content">
            <Button
              variant="outline"
              size="default"
              onClick={onViewOntology}
              disabled={!selectedOntology}
            >
              <Eye className="h-4 w-4" />
              View
            </Button>
          </Tip>
          <Tip label={__DEMO__ ? "Not available in preview" : "Classify unclassified objects"}>
            <Button
              variant="outline"
              size="default"
              onClick={onClassify}
              disabled={__DEMO__ || !selectedOntology || !hasData || !!classifying || !!enhancing || !!classificationCompleted}
            >
              <Sparkles className="h-4 w-4" />
              Classify
            </Button>
          </Tip>
          {aiAvailable && (
            <Tip label={__DEMO__ ? "Not available in preview" : "AI-enhance low-confidence classifications"}>
              <Button
                variant="outline"
                size="default"
                onClick={onEnhance}
                disabled={__DEMO__ || !hasClassifiedData || !!enhancing || !!classifying}
                className={enhancing ? "border-accent-purple text-accent-purple" : ""}
              >
                <Wand2 className="h-4 w-4" />
                Enhance
              </Button>
            </Tip>
          )}
        </div>

        {showProgress ? (
          <div className={`hidden md:flex flex-1 items-center gap-3 min-w-0 relative ${paused ? "animations-paused" : ""}`}>
            <div className="flex items-center gap-2 text-xs text-text-secondary shrink-0">
              {enhancing ? <Wand2 className="w-4 h-4 text-accent-purple animate-pulse" /> : classifying ? <Sparkles className="w-4 h-4 text-accent-purple animate-pulse" /> : discovering ? <RadarIcon /> : scanProgress ? <EqualizerIcon /> : null}
              {enhancing ? <span>Enhancing with AI&hellip;</span> : classifying ? <span>Classifying entities&hellip;</span> : discovering ? <span>Scanning network&hellip;</span> : scanProgress ? <span>Scanning devices {scanProgress.done}/{scanProgress.total}</span> : null}
            </div>
            <div className="flex-1 bg-bg-tertiary rounded-full h-1.5 overflow-hidden relative">
              {discovering || classifying || enhancing ? (
                <div
                  className="h-full w-full rounded-full"
                  style={{
                    backgroundImage: (classifying || enhancing)
                      ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(163,113,247,0.3) 4px, rgba(163,113,247,0.3) 8px)"
                      : "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(88,166,255,0.3) 4px, rgba(88,166,255,0.3) 8px)",
                    backgroundSize: "20px 20px",
                    backgroundColor: (classifying || enhancing) ? "rgba(163,113,247,0.5)" : "rgba(88,166,255,0.5)",
                    animation: "stripe-move 0.6s linear infinite",
                  }}
                />
              ) : (
                <div
                  className="h-full bg-accent-blue rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${progressPct}%`,
                    boxShadow: "0 0 12px rgba(88,166,255,0.5), 0 0 24px rgba(88,166,255,0.2)",
                  }}
                />
              )}
            </div>
            {scanProgress && (
              <span className="text-[11px] text-text-secondary tabular-nums shrink-0">
                {Math.round(progressPct)}%
              </span>
            )}
            {showCelebration && <CelebrationDots />}
          </div>
        ) : (
          <div className="hidden md:block flex-1" />
        )}

        <div className="flex-1 md:hidden" />

        {hasData && !scanning && !discovering && (
          <Tip label="Discard discovered data">
            <Button variant="outline" size="default" onClick={onClearData}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </Tip>
        )}
        <Tip label="Edit raw discovery schema">
          <Button variant="outline" size="default" onClick={onSchemaEdit}>
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Schema</span>
          </Button>
        </Tip>

        <Tip label={discovering ? "Finding devices..." : scanning ? "Pause device scanning" : paused ? "Resume scanning" : "Scan the BACnet network"}>
          <Button
            onClick={scanning ? onPauseScan : paused ? onResumeScan : onDiscover}
            disabled={!scanning && !paused && discovering}
            variant={scanning ? "outline" : "default"}
            size="default"
            className={!scanning ? "shadow-[0_0_12px_rgba(88,166,255,0.4)]" : ""}
          >
            {discovering ? (
              <span className="block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : scanning ? (
              <Pause className="h-4 w-4" />
            ) : paused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{scanning ? "Pause" : paused ? "Resume" : "Discover"}</span>
          </Button>
        </Tip>
      </div>

      <div className="flex md:hidden items-center gap-2 px-3 py-2 overflow-x-auto">
        <Select
          value={selectedOntology || "__none__"}
          onValueChange={(v) => onSelectOntology(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="w-[160px] bg-bg-tertiary border-none text-xs h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Topology: none</SelectItem>
            {ontologies.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}{o.version ? ` v${o.version}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewOntology}
          disabled={!selectedOntology}
        >
          <Eye className="h-4 w-4" />
          View
        </Button>
        <Tip label={__DEMO__ ? "Not available in preview" : "Classify"}>
          <Button
            variant="outline"
            size="sm"
            onClick={onClassify}
            disabled={__DEMO__ || !selectedOntology || !hasData || !!classifying || !!enhancing || !!classificationCompleted}
          >
            <Sparkles className="h-4 w-4" />
            Classify
          </Button>
        </Tip>
        {aiAvailable && (
          <Tip label={__DEMO__ ? "Not available in preview" : "Enhance"}>
            <Button
              variant="outline"
              size="sm"
              onClick={onEnhance}
              disabled={__DEMO__ || !hasClassifiedData || !!enhancing || !!classifying}
              className={enhancing ? "border-accent-purple text-accent-purple" : ""}
            >
              <Wand2 className="h-4 w-4" />
              Enhance
            </Button>
          </Tip>
        )}
        {showProgress ? (
          <div className={`flex items-center gap-1.5 text-xs text-text-secondary ml-auto shrink-0 ${paused ? "animations-paused" : ""}`}>
            {enhancing ? <Wand2 className="w-4 h-4 text-accent-purple animate-pulse" /> : classifying ? <Sparkles className="w-4 h-4 text-accent-purple animate-pulse" /> : discovering ? <RadarIcon /> : <EqualizerIcon />}
            {enhancing ? <span>Enhancing&hellip;</span> : classifying ? <span>Classifying&hellip;</span> : discovering ? <span>Scanning&hellip;</span> : scanProgress ? <span>{scanProgress.done}/{scanProgress.total}</span> : null}
          </div>
        ) : null}
      </div>

      {(currentPhase !== "idle" || classifying) && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-px ${paused ? "animations-paused" : ""}`}
          style={{
            background: classifying
              ? "linear-gradient(90deg, transparent, var(--color-accent-purple), var(--color-accent-blue), var(--color-accent-purple), transparent)"
              : "linear-gradient(90deg, transparent, var(--color-accent-blue), var(--color-accent-purple), var(--color-accent-blue), transparent)",
            backgroundSize: "200% 100%",
            animation: "header-glow 4s linear infinite",
          }}
        />
      )}
    </header>
  );
}
