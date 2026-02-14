"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GraduationCap } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/components/graph/KnowledgeGraph";
import SidePanel from "@/components/student/SidePanel";
import { type TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
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
    <div className="flex h-screen flex-col bg-[#0f172a] text-slate-200 relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background atmosphere gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] rounded-full bg-teal-900/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-200">Prereq</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-slate-500">Live Lecture</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/student/${studentId}/tutor`)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-indigo-900/20 transition-all hover:scale-105"
          >
            <GraduationCap size={16} />
            <span>Start Tutoring</span>
          </button>
          {user && (
            <button
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Sign out
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-inner border border-white/10">
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
            <div className="flex h-full items-center justify-center bg-slate-900/50 rounded-xl border border-slate-700/50">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center animate-pulse">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <p className="text-sm text-slate-400">Loading graph...</p>
              </div>
            </div>
          )}

          {/* Mastery summary pill */}
          {nodes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 backdrop-blur-sm rounded-full border border-slate-700/50 shadow-lg">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.green }} />
                  <span className="text-xs font-medium text-slate-400">{masteryCounts.green}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.yellow }} />
                  <span className="text-xs font-medium text-slate-400">{masteryCounts.yellow}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.red }} />
                  <span className="text-xs font-medium text-slate-400">{masteryCounts.red}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX.gray }} />
                  <span className="text-xs font-medium text-slate-400">{masteryCounts.gray}</span>
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
          />
        </div>
      </main>
    </div>
  );
}
