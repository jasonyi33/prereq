"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const typeBadgeColor: Record<string, string> = {
    video: "#ef4444",
    article: "#3b82f6",
    textbook: "#8b5cf6",
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-lg">{node.label}</CardTitle>
          {node.category && (
            <p className="text-sm text-muted-foreground">{node.category}</p>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">
          &times;
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge style={{ backgroundColor: colorHex, color: "#fff" }}>
            {node.color}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Confidence: {(node.confidence * 100).toFixed(0)}%
          </span>
        </div>

        {node.description && <p className="text-sm">{node.description}</p>}

        {/* Green: mastery summary */}
        {isMastered && (
          <p className="text-sm text-green-600 font-medium">
            You&apos;ve mastered this concept!
          </p>
        )}

        {/* Gray: not yet covered */}
        {node.color === "gray" && (
          <p className="text-sm text-muted-foreground italic">
            This concept hasn&apos;t been covered yet.
          </p>
        )}

        {/* Red/Yellow: transcript excerpts + resources */}
        {isStruggling && (
          <>
            {/* Lecture Moments */}
            <div>
              <h4 className="text-sm font-semibold mb-1">Lecture Moments</h4>
              {loadingTranscripts ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : transcripts.length > 0 ? (
                <ul className="space-y-1.5">
                  {transcripts.map((t, i) => (
                    <li key={i} className="text-xs border-l-2 border-muted pl-2">
                      <span className="font-mono text-muted-foreground">
                        {formatTimestamp(t.timestamp_sec)}
                      </span>{" "}
                      {t.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No lecture excerpts found for this concept.
                </p>
              )}
            </div>

            {/* Additional Resources */}
            <div>
              <h4 className="text-sm font-semibold mb-1">Additional Resources</h4>
              {loadingResources ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : resources.length > 0 ? (
                <ul className="space-y-1.5">
                  {resources.map((r, i) => (
                    <li key={i} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0"
                          style={{ borderColor: typeBadgeColor[r.type] || "#6b7280", color: typeBadgeColor[r.type] || "#6b7280" }}
                        >
                          {r.type}
                        </Badge>
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
                        <p className="text-muted-foreground mt-0.5 line-clamp-2">{r.snippet}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">No resources found.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
