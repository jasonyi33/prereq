"use client";

import { useState, useMemo } from "react";
import { COLOR_HEX } from "@/lib/colors";

export interface HeatmapConcept {
  id: string;
  label: string;
  category?: string;
  distribution: { green: number; yellow: number; red: number; gray: number };
  avg_confidence: number;
}

interface ConceptHeatmapProps {
  concepts: HeatmapConcept[];
  totalStudents: number;
  activeConceptId?: string | null;
}

const SEGMENT_COLORS = [
  { key: "green" as const, label: "Mastery", hex: COLOR_HEX.green },
  { key: "yellow" as const, label: "Partial", hex: "#f59e0b" },
  { key: "red" as const, label: "Struggling", hex: COLOR_HEX.red },
  { key: "gray" as const, label: "Unvisited", hex: "#cbd5e1" },
];

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.7
      ? "text-emerald-600"
      : value >= 0.4
        ? "text-amber-600"
        : value > 0
          ? "text-red-500"
          : "text-slate-400";
  return (
    <span className={`text-[11px] font-mono font-semibold tabular-nums ${color}`}>
      {pct}%
    </span>
  );
}

function ConceptRow({
  concept,
  totalStudents,
  isActive,
}: {
  concept: HeatmapConcept;
  totalStudents: number;
  isActive: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = totalStudents || 1;

  return (
    <div
      className={`group relative rounded-xl px-3 py-2.5 transition-all duration-300 ${
        isActive
          ? "bg-blue-50 ring-1 ring-blue-300"
          : "hover:bg-slate-50"
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-500 animate-pulse" />
      )}

      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[13px] font-medium truncate max-w-[200px] tracking-tight ${
            isActive ? "text-blue-700" : "text-slate-700"
          }`}
        >
          {concept.label}
        </span>
        <ConfidencePill value={concept.avg_confidence} />
      </div>

      <div
        className="relative flex h-[22px] w-full overflow-hidden rounded-lg bg-slate-100"
        onMouseLeave={() => setHovered(null)}
      >
        {SEGMENT_COLORS.map(({ key, hex }) => {
          const count = concept.distribution[key];
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className="relative h-full transition-all duration-500 ease-out cursor-default"
              style={{
                width: `${pct}%`,
                backgroundColor: hex,
                opacity: hovered && hovered !== key ? 0.4 : 1,
              }}
              onMouseEnter={() => setHovered(key)}
            >
              {pct > 18 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm">
                  {count}
                </span>
              )}
            </div>
          );
        })}

        {hovered && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-800 text-[10px] text-white whitespace-nowrap z-10 shadow-xl pointer-events-none">
            {concept.distribution[hovered as keyof typeof concept.distribution]}{" "}
            {hovered === "green"
              ? "mastered"
              : hovered === "yellow"
                ? "partial"
                : hovered === "red"
                  ? "struggling"
                  : "unvisited"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConceptHeatmap({
  concepts,
  totalStudents,
  activeConceptId,
}: ConceptHeatmapProps) {
  const [sortMode, setSortMode] = useState<"category" | "struggling">("category");

  const grouped = useMemo(() => {
    const sorted = [...concepts];

    if (sortMode === "struggling") {
      sorted.sort((a, b) => {
        const aStruggle = a.distribution.red / (totalStudents || 1);
        const bStruggle = b.distribution.red / (totalStudents || 1);
        return bStruggle - aStruggle;
      });
      return [{ category: "All Concepts", concepts: sorted }];
    }

    const groups: Record<string, HeatmapConcept[]> = {};
    for (const c of sorted) {
      const cat = c.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    }

    for (const cat in groups) {
      groups[cat].sort((a, b) => {
        const aStruggle = a.distribution.red / (totalStudents || 1);
        const bStruggle = b.distribution.red / (totalStudents || 1);
        return bStruggle - aStruggle;
      });
    }

    return Object.entries(groups).map(([category, concepts]) => ({
      category,
      concepts,
    }));
  }, [concepts, totalStudents, sortMode]);

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
            Class Mastery Heatmap
          </h3>
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-slate-100">
            <button
              onClick={() => setSortMode("category")}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                sortMode === "category"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              By Category
            </button>
            <button
              onClick={() => setSortMode("struggling")}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                sortMode === "struggling"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Most Struggling
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {SEGMENT_COLORS.map(({ key, label, hex }) => (
              <div key={key} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-[10px] text-slate-400 tracking-tight">{label}</span>
              </div>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 tracking-tight">
            {totalStudents} students
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {concepts.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-slate-400">No concept data yet</p>
          </div>
        )}

        {grouped.map(({ category, concepts: groupConcepts }) => (
          <div key={category} className="mb-2 last:mb-0">
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm px-3 py-2">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  {category}
                </span>
                <span className="text-[10px] text-slate-300 tabular-nums">
                  {groupConcepts.length}
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>

            <div className="space-y-0.5">
              {groupConcepts.map((c) => (
                <ConceptRow
                  key={c.id}
                  concept={c}
                  totalStudents={totalStudents}
                  isActive={activeConceptId === c.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
