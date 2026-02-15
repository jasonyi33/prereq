"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { nextApi } from "@/lib/api";

interface Suggestion {
  conceptId: string;
  conceptLabel: string;
  suggestion: string;
}

interface InterventionPanelProps {
  lectureId: string | null;
  strugglingConceptIds: string[];
  timelineConceptIds: string[];
  transcriptChunkCount: number;
}

const AUTO_INTERVAL_MS = 120_000; // 2 minutes
const MIN_NEW_CHUNKS = 1;
const GLOW_DURATION_MS = 3000;

function formatTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  return `${mins}m ago`;
}

export default function InterventionPanel({
  lectureId,
  strugglingConceptIds,
  timelineConceptIds,
  transcriptChunkCount,
}: InterventionPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glowing, setGlowing] = useState(false);
  const [lastGenTime, setLastGenTime] = useState<number | null>(null);
  const [, setTick] = useState(0); // force re-render for "Updated Xm ago"
  const lastGenChunkCountRef = useRef(0);

  const fetchSuggestions = useCallback(
    async (isAuto: boolean) => {
      if (!lectureId) return;
      // No longer need concepts - just call the endpoint
      if (isAuto) setAutoLoading(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await nextApi.post(
          `/api/lectures/${lectureId}/interventions`,
          {} // Empty body - endpoint uses transcript only
        );
        if (data.suggestions) {
          setSuggestions(data.suggestions);
          setLastGenTime(Date.now());
          lastGenChunkCountRef.current = transcriptChunkCount;
          // Trigger glow
          setGlowing(true);
          setTimeout(() => setGlowing(false), GLOW_DURATION_MS);
        }
      } catch (err: unknown) {
        if (!isAuto) {
          const message =
            err instanceof Error ? err.message : "Failed to get suggestions";
          setError(message);
        }
      } finally {
        if (isAuto) setAutoLoading(false);
        else setLoading(false);
      }
    },
    [lectureId, strugglingConceptIds, timelineConceptIds, transcriptChunkCount]
  );

  // Auto-timer: every 2 minutes, generate if enough new chunks
  useEffect(() => {
    if (!lectureId) return;
    const interval = setInterval(() => {
      const newChunks = transcriptChunkCount - lastGenChunkCountRef.current;
      // No longer need concepts - just check for new chunks
      if (newChunks >= MIN_NEW_CHUNKS) {
        fetchSuggestions(true);
      }
    }, AUTO_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [lectureId, transcriptChunkCount, fetchSuggestions]);

  // Tick every 30s to update "Updated Xm ago"
  useEffect(() => {
    if (!lastGenTime) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [lastGenTime]);

  function handleGetSuggestions() {
    fetchSuggestions(false);
  }

  const isLiveNoSuggestions =
    !!lectureId && suggestions.length === 0 && !loading && !autoLoading;

  return (
    <div
      className={`rounded-2xl bg-white border p-5 transition-all duration-500 ${
        glowing
          ? "border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
          : "border-gray-200/80"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-gray-800 tracking-tight">
          Teaching Suggestions
        </h3>
        {autoLoading && (
          <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        )}
        {lastGenTime && !autoLoading && (
          <span className="text-[10px] text-gray-400">
            Updated {formatTimeAgo(lastGenTime)}
          </span>
        )}
      </div>
      <div className="space-y-3">
        <button
          onClick={handleGetSuggestions}
          disabled={loading || !lectureId || transcriptChunkCount === 0}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Get Suggestions"}
        </button>
        {transcriptChunkCount === 0 && !loading && !autoLoading && (
          <p className="text-xs text-gray-400">
            Waiting for transcript...
          </p>
        )}
        {isLiveNoSuggestions && strugglingConceptIds.length > 0 && (
          <p className="text-xs text-gray-400">
            Suggestions will appear automatically as the lecture progresses
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.conceptId}
                className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1"
              >
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {s.conceptLabel}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {s.suggestion}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
