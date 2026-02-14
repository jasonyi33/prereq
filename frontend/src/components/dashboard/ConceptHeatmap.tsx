"use client";

import { useState, useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { COLOR_HEX, confidenceToFill } from "@/lib/colors";

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

/* ── Summary Metrics ──────────────────────────────────────────── */

function SummaryMetrics({
  concepts,
  totalStudents,
}: {
  concepts: HeatmapConcept[];
  totalStudents: number;
}) {
  const avgConfidence =
    concepts.length > 0
      ? concepts.reduce((sum, c) => sum + c.avg_confidence, 0) / concepts.length
      : 0;
  const masteredCount = concepts.filter((c) => c.avg_confidence >= 0.7).length;
  const strugglingCount = concepts.filter(
    (c) => c.avg_confidence > 0 && c.avg_confidence < 0.4,
  ).length;
  const pct = Math.round(avgConfidence * 100);

  const ringColor =
    avgConfidence >= 0.7
      ? "#22c55e"
      : avgConfidence >= 0.4
        ? "#eab308"
        : avgConfidence > 0
          ? "#ef4444"
          : "#94a3b8";

  return (
    <div className="flex items-center gap-2">
      {/* Class Mastery */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50">
        <svg width="22" height="22" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke={ringColor}
            strokeWidth="3"
            strokeDasharray={`${pct * 0.628} 62.8`}
            strokeLinecap="round"
            transform="rotate(-90 12 12)"
          />
        </svg>
        <div className="leading-tight">
          <div className="text-[9px] text-slate-400">Mastery</div>
          <div className="text-xs font-semibold text-slate-700">{pct}%</div>
        </div>
      </div>

      {/* Mastered */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <div className="leading-tight">
          <div className="text-[9px] text-slate-400">Mastered</div>
          <div className="text-xs font-semibold text-emerald-600">{masteredCount}</div>
        </div>
      </div>

      {/* Struggling */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <div className="leading-tight">
          <div className="text-[9px] text-slate-400">Struggling</div>
          <div className="text-xs font-semibold text-red-600">{strugglingCount}</div>
        </div>
      </div>

      {/* Students */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <div className="leading-tight">
          <div className="text-[9px] text-slate-400">Students</div>
          <div className="text-xs font-semibold text-slate-700">{totalStudents}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Gradient Legend ───────────────────────────────────────────── */

function GradientLegend() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-[100px] h-2.5 rounded-full"
        style={{
          background:
            "linear-gradient(to right, #e2e8f0, #fecaca, #fed7aa, #fef08a, #d9f99d, #bbf7d0, #86efac)",
        }}
      />
      <div className="flex text-[9px] text-slate-400 gap-2 tabular-nums">
        <span>0%</span>
        <span>40%</span>
        <span>70%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/* ── Custom Treemap Cell ──────────────────────────────────────── */

/** Split text into lines that fit within maxWidth (px), assuming ~6.5px per char at fontSize 11 */
function wrapText(text: string, maxWidth: number, fontSize: number = 11): string[] {
  const charWidth = fontSize * 0.59;
  const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
  if (text.length <= maxChars) return [text];

  // Split on spaces and underscores; detect which separator to use when rejoining
  const words = text.split(/[_\s]+/);
  const sep = text.includes("_") ? "_" : " ";
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + sep + word : word;
    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars - 1) + "\u2026" : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTreemapCell(props: any) {
  const {
    x,
    y,
    width,
    height,
    depth,
    name,
    concept,
    activeConceptId,
    totalStudents,
  } = props;

  // Root node (entire chart area) — render nothing
  if (depth === 0) return <g />;

  // Category parent (depth 1, no concept data) — subtle background
  if (!concept) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="#f8fafc"
          stroke="#e2e8f0"
          strokeWidth={1}
        />
        {width > 70 && height > 18 && (
          <text
            x={x + 6}
            y={y + 13}
            fontSize={9}
            fontWeight={700}
            fill="#94a3b8"
            style={{ textTransform: "uppercase" as const, letterSpacing: "0.08em" }}
          >
            {name.length > Math.floor(width / 6)
              ? name.slice(0, Math.floor(width / 6)) + "…"
              : name}
          </text>
        )}
      </g>
    );
  }

  // Leaf node — colored concept tile
  const fill = confidenceToFill(concept.avg_confidence);
  const isActive = activeConceptId === concept.id;
  const pct = Math.round(concept.avg_confidence * 100);
  const total = totalStudents || 1;

  const pad = 1.5;
  const rw = Math.max(0, width - pad * 2);
  const rh = Math.max(0, height - pad * 2);

  // Micro distribution bar
  const dist = concept.distribution;
  const barW = Math.min(rw - 12, 50);
  const barY = y + pad + rh - 10;
  const segments = [
    { count: dist.green, color: COLOR_HEX.green },
    { count: dist.yellow, color: "#f59e0b" },
    { count: dist.red, color: COLOR_HEX.red },
    { count: dist.gray, color: "#cbd5e1" },
  ];

  return (
    <g>
      <rect
        x={x + pad}
        y={y + pad}
        width={rw}
        height={rh}
        rx={5}
        fill={fill}
        stroke={isActive ? "#3b82f6" : "rgba(255,255,255,0.8)"}
        strokeWidth={isActive ? 2.5 : 1}
      />

      {/* Active glow */}
      {isActive && (
        <rect
          x={x + pad - 1}
          y={y + pad - 1}
          width={rw + 2}
          height={rh + 2}
          rx={6}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1}
          opacity={0.3}
        />
      )}

      {/* Full label + percentage */}
      {rw > 60 && rh > 40 && (() => {
        const lines = wrapText(name, rw - 14);
        const lineHeight = 14;
        const maxLines = Math.max(1, Math.floor((rh - 24) / lineHeight));
        const displayLines = lines.slice(0, maxLines);
        if (displayLines.length < lines.length) {
          const last = displayLines[displayLines.length - 1];
          displayLines[displayLines.length - 1] = last.slice(0, -1) + "\u2026";
        }
        return (
          <>
            <text
              x={x + pad + 7}
              y={y + pad + 16}
              fontSize={11}
              fontWeight={600}
              fill="#334155"
              style={{ pointerEvents: "none" }}
            >
              {displayLines.map((line, i) => (
                <tspan key={i} x={x + pad + 7} dy={i === 0 ? 0 : lineHeight}>
                  {line}
                </tspan>
              ))}
            </text>
            <text
              x={x + pad + 7}
              y={y + pad + 16 + displayLines.length * lineHeight}
              fontSize={10}
              fontWeight={500}
              fill="#64748b"
              style={{ pointerEvents: "none" }}
            >
              {pct}%
            </text>
          </>
        );
      })()}

      {/* Single-line label + percentage (wide-but-short or medium cells) */}
      {rw > 40 && rh > 25 && !(rw > 60 && rh > 40) && (() => {
        const maxChars = Math.max(1, Math.floor((rw - 14) / 6.5));
        const label = name.length > maxChars ? name.slice(0, maxChars - 1) + "\u2026" : name;
        return (
          <>
            <text
              x={x + pad + 5}
              y={y + pad + 13}
              fontSize={10}
              fontWeight={600}
              fill="#334155"
              style={{ pointerEvents: "none" }}
            >
              {label}
            </text>
            <text
              x={x + pad + 5}
              y={y + pad + 24}
              fontSize={9}
              fontWeight={500}
              fill="#64748b"
              style={{ pointerEvents: "none" }}
            >
              {pct}%
            </text>
          </>
        );
      })()}

      {/* Compact: percentage only (very narrow cells) */}
      {rw > 25 && rw <= 40 && rh > 20 && (
        <text
          x={x + pad + 3}
          y={y + pad + 13}
          fontSize={9}
          fontWeight={600}
          fill="#475569"
          style={{ pointerEvents: "none" }}
        >
          {pct}%
        </text>
      )}

      {/* Micro distribution bar */}
      {rw > 50 && rh > 50 && (
        <g>
          {(() => {
            let ox = x + pad + 7;
            return segments.map(({ count, color }, i) => {
              const w = (count / total) * barW;
              const el =
                w > 0 ? (
                  <rect
                    key={i}
                    x={ox}
                    y={barY}
                    width={w}
                    height={4}
                    rx={1}
                    fill={color}
                    opacity={0.8}
                  />
                ) : null;
              ox += w;
              return el;
            });
          })()}
        </g>
      )}
    </g>
  );
}

/* ── Custom Tooltip ───────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  const concept = data?.concept;
  if (!concept) return null;

  const pct = Math.round(concept.avg_confidence * 100);
  const dist = concept.distribution;

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-3 min-w-[180px]">
      <div className="text-sm font-semibold text-slate-800 mb-0.5">
        {concept.label}
      </div>
      {concept.category && (
        <div className="text-[10px] text-slate-400 mb-2">{concept.category}</div>
      )}
      <div className="text-xs font-medium text-slate-600 mb-2">
        Avg confidence: {pct}%
      </div>
      <div className="space-y-1 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: COLOR_HEX.green }}
          />
          {dist.green} mastered
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#f59e0b" }}
          />
          {dist.yellow} partial
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: COLOR_HEX.red }}
          />
          {dist.red} struggling
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#cbd5e1" }}
          />
          {dist.gray} unvisited
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function ConceptHeatmap({
  concepts,
  totalStudents,
  activeConceptId,
}: ConceptHeatmapProps) {
  const [sortMode, setSortMode] = useState<"category" | "struggling">("category");

  const treemapData = useMemo(() => {
    if (sortMode === "category") {
      const groups: Record<string, HeatmapConcept[]> = {};
      for (const c of concepts) {
        const cat = c.category || "Other";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(c);
      }
      return Object.entries(groups).map(([cat, items]) => ({
        name: cat,
        children: items.map((c) => ({
          name: c.label,
          size: 1,
          concept: c,
        })),
      }));
    }

    // Struggling mode — flat list, sized by struggle score
    return [...concepts]
      .sort((a, b) => a.avg_confidence - b.avg_confidence)
      .map((c) => ({
        name: c.label,
        size: Math.max(0.1, 1 - c.avg_confidence),
        concept: c,
      }));
  }, [concepts, sortMode]);

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
            Class Mastery Heatmap
          </h3>
          <SummaryMetrics concepts={concepts} totalStudents={totalStudents} />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
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
          <GradientLegend />
        </div>
      </div>

      {/* Treemap */}
      <div className="flex-1 min-h-0 px-2 pb-2">
        {concepts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">No concept data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="size"
              nameKey="name"
              content={
                <CustomTreemapCell
                  activeConceptId={activeConceptId}
                  totalStudents={totalStudents}
                />
              }
              isAnimationActive={true}
              animationDuration={500}
            >
              <Tooltip
                content={<CustomTooltip />}
                cursor={false}
              />
            </Treemap>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
