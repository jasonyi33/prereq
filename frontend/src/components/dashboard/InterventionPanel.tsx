"use client";

import { useState } from "react";
import { nextApi } from "@/lib/api";

interface Suggestion {
  conceptId: string;
  conceptLabel: string;
  suggestion: string;
}

interface InterventionPanelProps {
  lectureId: string | null;
  strugglingConceptIds: string[];
}

export default function InterventionPanel({
  lectureId,
  strugglingConceptIds,
}: InterventionPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleGetSuggestions() {
    if (!lectureId || strugglingConceptIds.length === 0) return;
    setLoading(true);
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/interventions`, {
        conceptIds: strugglingConceptIds,
      });
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("Failed to get suggestions:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-800 tracking-tight mb-3">
        Teaching Suggestions
      </h3>
      <div className="space-y-3">
        <button
          onClick={handleGetSuggestions}
          disabled={loading || !lectureId || strugglingConceptIds.length === 0}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? "Loading..." : "Get Suggestions"}
        </button>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.conceptId} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{s.conceptLabel}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{s.suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
