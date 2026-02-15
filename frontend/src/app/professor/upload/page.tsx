"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Upload, FileText, ArrowRight, Loader2 } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/components/graph/KnowledgeGraph";
import StarsBackground from "@/components/ui/StarsBackground";
import { flaskApi } from "@/lib/api";

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://localhost:5000";

const KnowledgeGraph = dynamic(() => import("@/components/graph/KnowledgeGraph"), {
  ssr: false,
});

type Stage = "idle" | "uploading" | "preview";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const courseId = typeof window !== "undefined" ? localStorage.getItem("courseId") : null;

  const uploadFile = useCallback(async (file: File) => {
    if (!courseId) {
      setError("No course found. Please create a course first.");
      return;
    }

    setFileName(file.name);
    setStage("uploading");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${FLASK_API_URL}/api/courses/${courseId}/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        let message = `Upload failed (${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      // Fetch the proper graph from the graph endpoint
      const graphData: {
        nodes: (GraphNode & { source_id?: string; target_id?: string })[];
        edges: { source_id?: string; target_id?: string; source?: string; target?: string }[];
      } = await flaskApi.get(`/api/courses/${courseId}/graph`);

      if (graphData.nodes) {
        setNodes(
          graphData.nodes.map((n) => ({
            ...n,
            color: n.color || "gray",
            confidence: n.confidence ?? 0,
          })),
        );
      }
      if (graphData.edges) {
        setEdges(
          graphData.edges.map((e) => ({
            source: e.source_id || e.source || "",
            target: e.target_id || e.target || "",
          })),
        );
      }

      setStage("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStage("idle");
    }
  }, [courseId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      uploadFile(file);
    } else {
      setError("Please upload a PDF file");
    }
  }, [uploadFile]);

  // --- Preview state: full-screen graph ---
  if (stage === "preview") {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="font-[family-name:var(--font-instrument-serif)] text-xl text-gray-800 tracking-tight">
              prereq
            </h1>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileText size={14} />
              <span>{fileName}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>{nodes.length} concepts</span>
              <span>&middot;</span>
              <span>{edges.length} relationships</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/professor/dashboard")}
            className="flex items-center gap-2 px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-all active:scale-[0.97]"
          >
            Continue to Dashboard
            <ArrowRight size={15} />
          </button>
        </header>

        {/* Graph fills remaining space */}
        <main className="flex-1 p-4 min-h-0">
          <KnowledgeGraph nodes={nodes} edges={edges} />
        </main>
      </div>
    );
  }

  // --- Idle / Uploading states ---
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <StarsBackground />

      <div className="relative z-10 w-full max-w-lg px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1
            className="font-[family-name:var(--font-instrument-serif)] text-5xl text-gray-800 tracking-tight mb-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            prereq
          </h1>
          <p className="text-sm text-gray-500 tracking-wide font-light">
            Upload your syllabus to build a knowledge graph
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl bg-white/70 border border-gray-200/80 backdrop-blur-2xl p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)]">
          {stage === "uploading" ? (
            // Uploading state
            <div className="flex flex-col items-center py-8">
              <Loader2 size={32} className="text-gray-400 animate-spin mb-4" />
              <p className="text-base font-medium text-gray-700 mb-2">Analyzing your syllabus...</p>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full mb-4">
                <FileText size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-mono">{fileName}</span>
              </div>
              <p className="text-xs text-gray-400">This usually takes 10-30 seconds</p>
            </div>
          ) : (
            // Idle state — drag and drop zone
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center py-12 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver
                    ? "border-gray-400 bg-gray-50/80"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
                }`}
              >
                <Upload size={28} className="text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600 mb-1">
                  Drop your PDF here, or click to browse
                </p>
                <p className="text-xs text-gray-400">
                  Syllabus, lecture notes, or course materials
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 mt-4 text-center">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Skip link */}
        {stage === "idle" && (
          <button
            onClick={() => router.push("/professor/dashboard")}
            className="flex items-center justify-center gap-1 mx-auto mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
