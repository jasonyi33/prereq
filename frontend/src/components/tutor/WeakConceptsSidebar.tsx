"use client";

import { BookOpen, CheckCircle2, AlertTriangle, Target, Circle } from "lucide-react";
import { COLOR_HEX } from "@/lib/colors";

export interface WeakConcept {
  id: string;
  label: string;
  color: string;
  confidence: number;
}

interface WeakConceptsSidebarProps {
  concepts: WeakConcept[];
}

function StatusIcon({ color }: { color: string }) {
  switch (color) {
    case "green":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case "yellow":
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    case "red":
      return <Target className="w-4 h-4 text-red-500 shrink-0" />;
    default:
      return <Circle className="w-4 h-4 text-slate-400 shrink-0" />;
  }
}

export default function WeakConceptsSidebar({ concepts }: WeakConceptsSidebarProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">Focus Areas</h3>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {concepts.length} concept{concepts.length !== 1 ? "s" : ""} to strengthen
        </p>
      </div>

      {/* Concept list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {concepts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">All concepts mastered!</p>
            <p className="text-xs text-gray-400 mt-0.5">Great work</p>
          </div>
        ) : (
          concepts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <StatusIcon color={c.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 truncate">{c.label}</span>
                  <span
                    className="text-xs font-mono tabular-nums shrink-0"
                    style={{ color: COLOR_HEX[c.color] || COLOR_HEX.gray }}
                  >
                    {(c.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 mt-1.5">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max(c.confidence * 100, 2)}%`,
                      backgroundColor: COLOR_HEX[c.color] || COLOR_HEX.gray,
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
