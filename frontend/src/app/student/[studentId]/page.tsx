"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import NodeDetailPanel from "@/components/graph/NodeDetailPanel";
import type { GraphNode, GraphEdge } from "@/components/graph/KnowledgeGraph";
import PollCard from "@/components/student/PollCard";
import TranscriptFeed, { type TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { flaskApi } from "@/lib/api";
import { confidenceToColor, COLOR_HEX } from "@/lib/colors";
import { getAncestors } from "@/lib/graph";
import { useAuth } from "@/lib/auth-context";

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
  const { user, signOut } = useAuth();

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

  // Mastery summary counts
  const masteryCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0, gray: 0 };
    for (const n of nodes) {
      const color = n.color || confidenceToColor(n.confidence ?? 0);
      if (color in counts) counts[color as keyof typeof counts]++;
    }
    return counts;
  }, [nodes]);

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
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 relative overflow-hidden">
      {/* Background blur blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-emerald-200/15 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between bg-white/70 backdrop-blur-sm border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 tracking-tight leading-tight">Prereq</h1>
            <p className="text-xs text-slate-500">Knowledge Graph</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/student/${studentId}/tutor`)}
            className="group relative overflow-hidden px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-2"
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <Sparkles className="w-4 h-4 relative" />
            <span className="relative">Start Tutoring</span>
          </button>
          {user && (
            <button
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden gap-3 p-3">
        {/* Left: Knowledge Graph */}
        <div className="w-3/5 relative rounded-2xl overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-200/80">
          <div ref={containerRef} className="w-full h-full">
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
              <div className="flex h-full items-center justify-center bg-slate-900/95">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center animate-pulse">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm text-slate-400">Loading graph...</p>
                </div>
              </div>
            )}
          </div>

          {/* Mastery summary pill */}
          {nodes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full border border-slate-200/80 shadow-lg">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.green }} />
                  <span className="text-xs font-medium text-slate-600">{masteryCounts.green}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.yellow }} />
                  <span className="text-xs font-medium text-slate-600">{masteryCounts.yellow}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.red }} />
                  <span className="text-xs font-medium text-slate-600">{masteryCounts.red}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.gray }} />
                  <span className="text-xs font-medium text-slate-600">{masteryCounts.gray}</span>
                </div>
              </div>
            </div>
          )}

          {/* Floating overlay panel */}
          {selectedNode && (
            <div className="absolute top-4 left-4 w-96 max-h-[calc(100%-2rem)] overflow-y-auto z-40">
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
          <div className="flex-1 overflow-y-auto">
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
