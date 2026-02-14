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

const KnowledgeGraph = dynamic(() => import("@/components/graph/KnowledgeGraph"), {
  ssr: false,
});

// Hardcoded demo course ID
const COURSE_ID = "demo-course";

// Mock graph data until Flask endpoint is available
const MOCK_NODES: GraphNode[] = [
  { id: "c1", label: "Gradient Descent", color: "yellow", confidence: 0.5, category: "Optimization", description: "Iterative optimization algorithm" },
  { id: "c2", label: "Backpropagation", color: "red", confidence: 0.15, category: "Neural Networks", description: "Algorithm for computing gradients in neural networks" },
  { id: "c3", label: "Loss Functions", color: "green", confidence: 0.8, category: "ML Foundations", description: "Functions that measure model prediction error" },
  { id: "c4", label: "Chain Rule", color: "yellow", confidence: 0.45, category: "Calculus", description: "Derivative of composite functions" },
  { id: "c5", label: "Activation Functions", color: "red", confidence: 0.2, category: "Neural Networks", description: "Non-linear functions applied to neuron outputs" },
  { id: "c6", label: "Linear Algebra", color: "green", confidence: 0.85, category: "Linear Algebra", description: "Study of vectors and matrices" },
  { id: "c7", label: "Derivatives", color: "green", confidence: 0.75, category: "Calculus", description: "Rate of change of a function" },
  { id: "c8", label: "SGD", color: "gray", confidence: 0, category: "Optimization", description: "Stochastic gradient descent" },
];

const MOCK_EDGES: GraphEdge[] = [
  { source: "c7", target: "c4" },
  { source: "c4", target: "c2" },
  { source: "c6", target: "c1" },
  { source: "c3", target: "c1" },
  { source: "c1", target: "c8" },
  { source: "c2", target: "c5" },
];

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

  const [nodes, setNodes] = useState<GraphNode[]>(MOCK_NODES);
  const [edges] = useState<GraphEdge[]>(MOCK_EDGES);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Try fetching real graph data
  useEffect(() => {
    flaskApi
      .get(`/api/courses/${COURSE_ID}/graph?student_id=${studentId}`)
      .then((data) => {
        if (data.nodes && data.nodes.length > 0) {
          setNodes(
            data.nodes.map((n: GraphNode) => ({
              ...n,
              color: n.color || confidenceToColor(n.confidence ?? 0),
            })),
          );
        }
      })
      .catch(() => {
        // Use mock data
      });
  }, [studentId]);

  // Join lecture room
  useEffect(() => {
    socket.emit("lecture:join", {
      lectureId: "mock-lecture-1",
      role: "student",
      studentId,
    });
  }, [socket, studentId]);

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
      // Clear glow after 5 seconds
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
        <div ref={containerRef} className="w-3/5 border-r">
          {dimensions.width > 0 && (
            <KnowledgeGraph
              nodes={nodes}
              edges={edges}
              activeConceptId={activeConceptId}
              onNodeClick={setSelectedNode}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>

        {/* Right: Active Panel */}
        <div className="w-2/5 flex flex-col overflow-hidden">
          {selectedNode && (
            <div className="p-3 border-b">
              <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
            </div>
          )}

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
