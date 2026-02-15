"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GraduationCap, Users, FileText } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/components/graph/KnowledgeGraph";
import SidePanel, { type LectureSummaryData } from "@/components/student/SidePanel";
import { type TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { flaskApi } from "@/lib/api";
import { confidenceToColor } from "@/lib/colors";
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
  const [lectureEnded, setLectureEnded] = useState(false);
  const [lectureSummary, setLectureSummary] = useState<LectureSummaryData | null>(null);

  // Get courseId from localStorage (reactive — poll until available)
  const [courseId, setCourseId] = useState<string | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("courseId");
    if (stored) { setCourseId(stored); return; }
    // If not set yet (race with navigation), poll briefly
    const interval = setInterval(() => {
      const v = localStorage.getItem("courseId");
      if (v) { setCourseId(v); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Mastery summary counts
  const masteryCounts = useMemo(() => {
    const counts = { mastered: 0, good: 0, partial: 0, struggling: 0, notStarted: 0 };
    for (const n of nodes) {
      const c = n.confidence ?? 0;
      if (c === 0) counts.notStarted++;
      else if (c < 0.4) counts.struggling++;
      else if (c < 0.55) counts.partial++;
      else if (c < 0.7) counts.good++;
      else counts.mastered++;
    }
    return counts;
  }, [nodes]);

  // Fetch real graph data (with retry on failure)
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    let attempt = 0;

    const fetchGraph = () => {
      flaskApi
        .get(`/api/courses/${courseId}/graph?student_id=${studentId}`)
        .then((data: { nodes: GraphNode[]; edges: { source_id?: string; target_id?: string; source?: string; target?: string }[] }) => {
          if (cancelled) return;
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
        .catch(() => {
          if (cancelled) return;
          attempt++;
          if (attempt < 5) {
            setTimeout(fetchGraph, 1500 * attempt);
          }
        });
    };

    fetchGraph();
    return () => { cancelled = true; };
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

    checkLiveLecture();
    const interval = setInterval(checkLiveLecture, 5000);
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

  // Lecture ended
  useSocketEvent<{ lectureId: string }>(
    "lecture:ended",
    useCallback(() => {
      setLectureEnded(true);
    }, []),
  );

  // Lecture summary ready
  useSocketEvent<{ lectureId: string; summary: LectureSummaryData }>(
    "lecture:summary-ready",
    useCallback((data) => {
      setLectureSummary(data.summary);
      // Highlight covered concepts on the graph
      if (data.summary.covered_concept_ids?.length) {
        setHighlightedNodeIds(new Set(data.summary.covered_concept_ids));
      }
    }, []),
  );

  // Weak concepts: covered in this lecture with confidence < 0.7
  const weakConcepts = useMemo(() => {
    if (!lectureSummary?.covered_concept_ids) return [];
    const coveredSet = new Set(lectureSummary.covered_concept_ids);
    return nodes
      .filter((n) => coveredSet.has(n.id) && (n.confidence ?? 0) > 0 && (n.confidence ?? 0) < 0.7)
      .map((n) => ({ id: n.id, label: n.label, confidence: n.confidence ?? 0 }))
      .sort((a, b) => a.confidence - b.confidence);
  }, [nodes, lectureSummary]);

  // Toggle selection: click same node = deselect
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (selectedNode?.id === node.id) {
        setSelectedNode(null);
        setHighlightedNodeIds(new Set());
      } else {
        setSelectedNode(node);
        const ancestors = getAncestors(node.id, edges);
        ancestors.add(node.id);
        setHighlightedNodeIds(ancestors);
      }
    },
    [edges, selectedNode?.id],
  );

  const handleDeselectNode = useCallback(() => {
    setSelectedNode(null);
    setHighlightedNodeIds(new Set());
  }, []);

  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-800 relative overflow-hidden font-sans">
      {/* Header */}
      <header className="relative z-10 h-14 flex items-center justify-between px-6 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-xl text-gray-800 tracking-tight">
            prereq
          </h1>
          <div className="flex items-center gap-1.5 ml-1">
            {lectureEnded ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="text-xs text-gray-400">Lecture Ended</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-gray-400">Live Lecture</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/student/${studentId}/tutor`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-all active:scale-[0.97]"
          >
            <GraduationCap size={15} />
            <span>Start Tutoring</span>
          </button>
          <button
            onClick={() => router.push(`/student/${studentId}/summaries`)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-400 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-all active:scale-[0.97]"
          >
            <FileText size={15} />
            <span>Summaries</span>
          </button>
          <button
            onClick={() => router.push(`/student/${studentId}/study-group`)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500/80 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-all active:scale-[0.97]"
          >
            <Users size={15} />
            <span>Find Study Partner</span>
          </button>
          {user && (
            <button
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-medium text-white">
            {(user?.email?.[0] || "S").toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Graph area */}
        <div className="flex-[3] h-full min-w-0 relative">
          {nodes.length > 0 ? (
            <KnowledgeGraph
              nodes={nodes}
              edges={edges}
              activeConceptId={activeConceptId}
              highlightedNodeIds={highlightedNodeIds}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white rounded-xl border border-gray-200">
              <div className="flex flex-col items-center gap-3">
                <p className="font-[family-name:var(--font-instrument-serif)] text-2xl text-gray-300 animate-pulse">prereq</p>
                <p className="text-sm text-gray-400">Loading graph...</p>
              </div>
            </div>
          )}

          {/* Mastery summary pill */}
          {nodes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full border border-gray-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#4ade80" }} />
                  <span className="text-xs font-medium text-gray-600">{masteryCounts.mastered}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#a3e635" }} />
                  <span className="text-xs font-medium text-gray-600">{masteryCounts.good}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#facc15" }} />
                  <span className="text-xs font-medium text-gray-600">{masteryCounts.partial}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#fb923c" }} />
                  <span className="text-xs font-medium text-gray-600">{masteryCounts.struggling}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                  <span className="text-xs font-medium text-gray-600">{masteryCounts.notStarted}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex-[2] h-full min-w-[320px] max-w-[450px] relative z-10">
          <SidePanel
            activePoll={activePoll}
            studentId={studentId}
            transcriptChunks={transcriptChunks}
            selectedNode={selectedNode}
            onDeselectNode={handleDeselectNode}
            lectureId={lectureId}
            courseId={courseId}
            lectureEnded={lectureEnded}
            lectureSummary={lectureSummary}
            weakConcepts={weakConcepts}
            onStartTutoring={() => router.push(`/student/${studentId}/tutor`)}
            onConceptClick={(conceptId) => {
              const node = nodes.find((n) => n.id === conceptId);
              if (node) handleNodeClick(node);
            }}
          />
        </div>
      </main>
    </div>
  );
}
