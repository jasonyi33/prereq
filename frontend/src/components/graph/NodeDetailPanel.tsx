"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { COLOR_HEX } from "@/lib/colors";
import { flaskApi, nextApi } from "@/lib/api";
import { formatTimestamp } from "@/lib/graph";
import type { GraphNode } from "./KnowledgeGraph";

interface TranscriptExcerpt {
  text: string;
  timestamp_sec: number;
}

interface Resource {
  title: string;
  url: string;
  type: string;
  snippet: string;
}

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
  lectureId?: string | null;
  courseId?: string | null;
}

export default function NodeDetailPanel({ node, onClose, lectureId, courseId }: NodeDetailPanelProps) {
  const [transcripts, setTranscripts] = useState<TranscriptExcerpt[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (!node) {
      setTranscripts([]);
      setResources([]);
      return;
    }

    const isStruggling = node.color === "red" || node.color === "yellow";
    if (!isStruggling) {
      setTranscripts([]);
      setResources([]);
      return;
    }

    // Fetch transcript excerpts
    if (lectureId) {
      setLoadingTranscripts(true);
      flaskApi
        .get(`/api/lectures/${lectureId}/transcript-excerpts?concept_ids=${node.id}`)
        .then((data: TranscriptExcerpt[]) => setTranscripts(data))
        .catch(() => setTranscripts([]))
        .finally(() => setLoadingTranscripts(false));
    }

    // Fetch resources via Next.js API (Perplexity)
    setLoadingResources(true);
    nextApi
      .get(`/api/resources/search?concept=${encodeURIComponent(node.label)}${courseId ? `&courseId=${courseId}` : ""}`)
      .then((data: { resources: Resource[] }) => setResources(data.resources || []))
      .catch(() => setResources([]))
      .finally(() => setLoadingResources(false));
  }, [node?.id, node?.color, lectureId, courseId]);

  if (!node) return null;

  const colorHex = COLOR_HEX[node.color] || COLOR_HEX.gray;
  const isStruggling = node.color === "red" || node.color === "yellow";
  const isMastered = node.color === "green";
  const confidencePct = Math.round(node.confidence * 100);

  const typeBadgeColor: Record<string, string> = {
    video: "#ef4444",
    article: "#3b82f6",
    textbook: "#8b5cf6",
  };

  return (
    <div className="w-full bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-800 tracking-tight">{node.label}</h3>
          {node.category && (
            <span className="inline-flex items-center mt-1.5 px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 rounded-full">
              {node.category}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 space-y-3">
        {/* Confidence bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Confidence</span>
            <span className="text-xs font-semibold" style={{ color: colorHex }}>{confidencePct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${confidencePct}%`, backgroundColor: colorHex }}
            />
          </div>
        </div>

        {node.description && <p className="text-sm text-slate-600 leading-relaxed">{node.description}</p>}

        {/* Green: mastery summary */}
        {isMastered && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-700">
              You&apos;ve mastered this concept!
            </p>
          </div>
        )}

        {/* Gray: not yet covered */}
        {node.color === "gray" && (
          <p className="text-sm text-slate-400 italic">
            This concept hasn&apos;t been covered yet.
          </p>
        )}

        {/* Red/Yellow: transcript excerpts + resources */}
        {isStruggling && (
          <>
            {/* Lecture Moments */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lecture Moments</h4>
              {loadingTranscripts ? (
                <p className="text-xs text-slate-400">Loading...</p>
              ) : transcripts.length > 0 ? (
                <ul className="space-y-2">
                  {transcripts.map((t, i) => (
                    <li key={i} className="text-xs border-l-2 border-blue-200 pl-2.5">
                      <span className="font-mono text-blue-500 text-[10px]">
                        {formatTimestamp(t.timestamp_sec)}
                      </span>{" "}
                      <span className="text-slate-600">{t.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No lecture excerpts found for this concept.
                </p>
              )}
            </div>

            {/* Additional Resources */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Additional Resources</h4>
              {loadingResources ? (
                <p className="text-xs text-slate-400">Loading...</p>
              ) : resources.length > 0 ? (
                <ul className="space-y-2">
                  {resources.map((r, i) => (
                    <li key={i} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center px-1.5 py-0 text-[10px] font-medium border rounded-md"
                          style={{ borderColor: typeBadgeColor[r.type] || "#6b7280", color: typeBadgeColor[r.type] || "#6b7280" }}
                        >
                          {r.type}
                        </span>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline truncate"
                        >
                          {r.title}
                        </a>
                      </div>
                      {r.snippet && (
                        <p className="text-slate-400 mt-0.5 line-clamp-2">{r.snippet}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">No resources found.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
