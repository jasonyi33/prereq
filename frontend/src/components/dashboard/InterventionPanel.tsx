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
  const [error, setError] = useState<string | null>(null);

  async function handleGetSuggestions() {
    if (!lectureId || strugglingConceptIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/interventions`, {
        conceptIds: strugglingConceptIds,
      });
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to get suggestions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 p-5">
      <h3 className="text-sm font-medium text-gray-800 tracking-tight mb-3">
        Teaching Suggestions
      </h3>
      <div className="space-y-3">
        <button
          onClick={handleGetSuggestions}
          disabled={loading || !lectureId || strugglingConceptIds.length === 0}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Get Suggestions"}
        </button>
        {strugglingConceptIds.length === 0 && !loading && (
          <p className="text-xs text-gray-400">No struggling concepts detected yet</p>
        )}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.conceptId} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.conceptLabel}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{s.suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
