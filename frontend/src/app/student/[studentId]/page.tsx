"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import NodeDetailPanel from "@/components/graph/NodeDetailPanel";
import type { GraphNode, GraphEdge } from "@/components/graph/KnowledgeGraph";
import PollCard from "@/components/student/PollCard";
import TranscriptFeed, { type TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { flaskApi } from "@/lib/api";
import { confidenceToColor } from "@/lib/colors";
import { getAncestors } from "@/lib/graph";

const KnowledgeGraph = dynamic(() => import("@/components/graph/KnowledgeGraph"), {
  ssr: false,
});

interface PollData {
  pollId: string;
  question: string;
  conceptLabel: string;
}

export default function StudentView() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const socket = useSocket();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Get courseId from localStorage
  const courseId = typeof window !== "undefined" ? localStorage.getItem("courseId") : null;

  // Fetch real graph data
  useEffect(() => {
    if (!courseId) return;
    flaskApi
      .get(`/api/courses/${courseId}/graph?student_id=${studentId}`)
      .then((data: { nodes: GraphNode[]; edges: { source_id?: string; target_id?: string; source?: string; target?: string }[] }) => {
        if (data.nodes && data.nodes.length > 0) {
          setNodes(
            data.nodes.map((n: GraphNode) => ({
              ...n,
              color: n.color || confidenceToColor(n.confidence ?? 0),
            })),
          );
        }
        if (data.edges) {
          setEdges(
            data.edges.map((e) => ({
              source: e.source_id || e.source || "",
              target: e.target_id || e.target || "",
            })),
          );
        }
      })
      .catch(() => {});
  }, [courseId, studentId]);

  // Poll for the latest live lecture every 5s so we auto-join when RTMS creates one
  useEffect(() => {
    if (!courseId) return;

    const checkLiveLecture = () => {
      flaskApi
        .get(`/api/courses/${courseId}/lectures`)
        .then((lectures: { id: string; status: string; started_at?: string }[]) => {
          const liveLectures = lectures.filter((l) => l.status === "live");
          liveLectures.sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));
          const live = liveLectures[0];
          if (live) {
            setLectureId((prev) => {
              if (prev !== live.id) {
                localStorage.setItem("lectureId", live.id);
              }
              return live.id;
            });
          } else if (!lectureId) {
            const storedLecture = localStorage.getItem("lectureId");
            if (storedLecture) setLectureId(storedLecture);
          }
        })
        .catch(() => {
          if (!lectureId) {
            const storedLecture = localStorage.getItem("lectureId");
            if (storedLecture) setLectureId(storedLecture);
          }
        });
    };

    checkLiveLecture(); // check immediately
    const interval = setInterval(checkLiveLecture, 5000); // then every 5s
    return () => clearInterval(interval);
  }, [courseId]);

  // Join lecture room
  useEffect(() => {
    if (!lectureId) return;
    socket.emit("lecture:join", {
      lectureId,
      role: "student",
      studentId,
    });
  }, [socket, lectureId, studentId]);

  // Measure container for graph sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Socket events
  useSocketEvent<{ text: string; timestamp: number; detectedConcepts?: { id: string; label: string }[] }>(
    "transcript:chunk",
    useCallback((data) => {
      setTranscriptChunks((prev) => [
        ...prev,
        {
          id: `tc-${Date.now()}`,
          text: data.text,
          timestamp: data.timestamp,
          detectedConcepts: data.detectedConcepts,
        },
      ]);
    }, []),
  );

  useSocketEvent<{ conceptId: string; label: string }>(
    "lecture:concept-detected",
    useCallback((data) => {
      setActiveConceptId(data.conceptId);
      setTimeout(() => setActiveConceptId(null), 5000);
    }, []),
  );

  useSocketEvent<PollData>(
    "poll:new-question",
    useCallback((data) => {
      setActivePoll(data);
    }, []),
  );

  useSocketEvent<{ studentId: string; conceptId: string; newColor: string; confidence: number }>(
    "mastery:updated",
    useCallback(
      (data) => {
        if (data.studentId !== studentId) return;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === data.conceptId
              ? { ...n, color: data.newColor, confidence: data.confidence }
              : n,
          ),
        );
      },
      [studentId],
    ),
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    const ancestors = getAncestors(node.id, edges);
    ancestors.add(node.id);
    setHighlightedNodeIds(ancestors);
  }, [edges]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold">Student View</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/student/${studentId}/tutor`)}
        >
          Start Tutoring
        </Button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Knowledge Graph */}
        <div ref={containerRef} className="w-3/5 border-r relative">
          {dimensions.width > 0 && nodes.length > 0 && (
            <KnowledgeGraph
              nodes={nodes}
              edges={edges}
              activeConceptId={activeConceptId}
              highlightedNodeIds={highlightedNodeIds}
              onNodeClick={handleNodeClick}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
          {nodes.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading graph...</p>
            </div>
          )}

          {/* Floating overlay panel */}
          {selectedNode && (
            <div className="absolute top-4 left-4 w-96 max-h-[calc(100%-2rem)] overflow-y-auto z-40 shadow-lg rounded-lg">
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => {
                  setSelectedNode(null);
                  setHighlightedNodeIds(new Set());
                }}
                lectureId={lectureId}
                courseId={courseId}
              />
            </div>
          )}
        </div>

        {/* Right: Active Panel */}
        <div className="w-2/5 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            {activePoll ? (
              <PollCard
                pollId={activePoll.pollId}
                question={activePoll.question}
                conceptLabel={activePoll.conceptLabel}
                studentId={studentId}
              />
            ) : (
              <TranscriptFeed chunks={transcriptChunks} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
