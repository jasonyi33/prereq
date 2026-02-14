"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  CheckCircle2,
  MessageSquare,
  BarChart2,
  BookOpen,
  AlertCircle,
  Sparkles,
  Mic,
  X,
} from "lucide-react";
import type { GraphNode } from "@/components/graph/KnowledgeGraph";
import type { TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
import { COLOR_HEX } from "@/lib/colors";
import { flaskApi, nextApi } from "@/lib/api";
import { formatTimestamp } from "@/lib/graph";
import PerplexityDialog from "./PerplexityDialog";

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

interface SidePanelProps {
  activePoll: { pollId: string; question: string; conceptLabel: string } | null;
  studentId: string;
  transcriptChunks: TranscriptChunk[];
  selectedNode: GraphNode | null;
  onDeselectNode: () => void;
  lectureId: string | null;
  courseId: string | null;
}

export default function SidePanel({
  activePoll,
  studentId,
  transcriptChunks,
  selectedNode,
  onDeselectNode,
  lectureId,
  courseId,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<"poll" | "transcript">("poll");

  // Poll state
  const [pollAnswer, setPollAnswer] = useState("");
  const [pollSubmitted, setPollSubmitted] = useState(false);
  const [pollFeedback, setPollFeedback] = useState<string | null>(null);
  const [pollLoading, setPollLoading] = useState(false);

  // Node detail state
  const [transcripts, setTranscripts] = useState<TranscriptExcerpt[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);

  // Perplexity dialog state
  const [perplexityOpen, setPerplexityOpen] = useState(false);

  // Transcript auto-scroll
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  // Reset poll state when poll changes
  useEffect(() => {
    setPollAnswer("");
    setPollSubmitted(false);
    setPollFeedback(null);
  }, [activePoll?.pollId]);

  // Auto-scroll transcript
  useEffect(() => {
    if (activeTab === "transcript") {
      transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcriptChunks.length, activeTab]);

  // Fetch node detail data when selectedNode changes
  useEffect(() => {
    if (!selectedNode) {
      setTranscripts([]);
      setResources([]);
      return;
    }

    const isStruggling = selectedNode.color === "red" || selectedNode.color === "yellow";
    if (!isStruggling) {
      setTranscripts([]);
      setResources([]);
      return;
    }

    if (lectureId) {
      setLoadingTranscripts(true);
      flaskApi
        .get(`/api/lectures/${lectureId}/transcript-excerpts?concept_ids=${selectedNode.id}`)
        .then((data: TranscriptExcerpt[]) => setTranscripts(data))
        .catch(() => setTranscripts([]))
        .finally(() => setLoadingTranscripts(false));
    }

    setLoadingResources(true);
    nextApi
      .get(`/api/resources/search?concept=${encodeURIComponent(selectedNode.label)}${courseId ? `&courseId=${courseId}` : ""}`)
      .then((data: { resources: Resource[] }) => setResources(data.resources || []))
      .catch(() => setResources([]))
      .finally(() => setLoadingResources(false));
  }, [selectedNode?.id, selectedNode?.color, lectureId, courseId]);

  // Poll submit handler
  async function handlePollSubmit() {
    if (!activePoll || !pollAnswer.trim()) return;
    setPollLoading(true);
    try {
      const res = await nextApi.post(`/api/polls/${activePoll.pollId}/respond`, {
        studentId,
        answer: pollAnswer.trim(),
      });
      setPollFeedback(res.evaluation?.feedback || "Answer submitted.");
      setPollSubmitted(true);
    } catch {
      setPollFeedback("Failed to submit. Please try again.");
    } finally {
      setPollLoading(false);
    }
  }

  // Node detail content
  const renderNodeContent = () => {
    if (!selectedNode) return null;

    const colorHex = COLOR_HEX[selectedNode.color] || COLOR_HEX.gray;
    const confidencePct = Math.round(selectedNode.confidence * 100);
    const isStruggling = selectedNode.color === "red" || selectedNode.color === "yellow";
    const isMastered = selectedNode.color === "green";

    return (
      <motion.div
        key="node-detail"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="h-full"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{selectedNode.label}</h2>
            {selectedNode.category && (
              <span className="inline-flex items-center mt-1 px-2 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                {selectedNode.category}
              </span>
            )}
          </div>
          <button
            onClick={onDeselectNode}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-slate-200 shrink-0 ml-2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Confidence bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Confidence</span>
            <span className="text-xs font-semibold" style={{ color: colorHex }}>
              {confidencePct}%
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${confidencePct}%`, backgroundColor: colorHex }}
            />
          </div>
        </div>

        {selectedNode.description && (
          <p className="text-sm text-slate-400 leading-relaxed mb-4">{selectedNode.description}</p>
        )}

        {/* Green: mastery summary */}
        {isMastered && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-green-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-green-400 font-medium text-sm">Concept Mastered</h3>
                <p className="text-slate-400 text-xs mt-1">
                  Great job! You&apos;ve demonstrated strong understanding.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Gray: not yet covered */}
        {selectedNode.color === "gray" && (
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <p className="text-sm text-slate-500 italic">
              This concept hasn&apos;t been covered yet in lecture.
            </p>
          </div>
        )}

        {/* Red/Yellow: needs attention */}
        {isStruggling && (
          <div className="space-y-5">
            <div
              className={`p-4 rounded-xl border ${
                selectedNode.color === "red"
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-yellow-500/10 border-yellow-500/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className={`shrink-0 mt-0.5 ${selectedNode.color === "red" ? "text-red-400" : "text-yellow-400"}`}
                  size={20}
                />
                <div>
                  <h3
                    className={`font-medium text-sm ${selectedNode.color === "red" ? "text-red-400" : "text-yellow-400"}`}
                  >
                    {selectedNode.color === "red" ? "Needs Attention" : "In Progress"}
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">Review these resources to strengthen your understanding.</p>
                </div>
              </div>
            </div>

            {/* Lecture Moments */}
            <div>
              <h4 className="text-[10px] font-medium text-slate-200 uppercase tracking-wider mb-2">
                Lecture Moments
              </h4>
              {loadingTranscripts ? (
                <p className="text-xs text-slate-500">Loading...</p>
              ) : transcripts.length > 0 ? (
                <div className="space-y-2">
                  {transcripts.map((t, i) => (
                    <div key={i} className="text-xs border-l-2 border-blue-500/40 pl-2.5 py-1">
                      <span className="font-mono text-blue-400 text-[10px]">
                        {formatTimestamp(t.timestamp_sec)}
                      </span>{" "}
                      <span className="text-slate-400">{t.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No lecture excerpts found.</p>
              )}
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-[10px] font-medium text-slate-200 uppercase tracking-wider mb-2">
                Recommended Resources
              </h4>
              {loadingResources ? (
                <p className="text-xs text-slate-500">Loading...</p>
              ) : resources.length > 0 ? (
                <div className="space-y-2">
                  {resources.map((r, i) => (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/30 group-hover:text-blue-300 transition-colors shrink-0">
                        {r.type === "video" ? (
                          <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-current border-b-[4px] border-b-transparent ml-0.5" />
                        ) : (
                          <BookOpen size={14} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{r.title}</p>
                        {r.snippet && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{r.snippet}</p>}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No resources found.</p>
              )}
            </div>

            {/* Perplexity AI button */}
            <button
              onClick={() => setPerplexityOpen(true)}
              className="w-full py-3 px-4 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-teal-500/20"
            >
              <Sparkles size={16} />
              <span>Ask Perplexity AI</span>
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl overflow-hidden shadow-xl">
      {/* Tab header */}
      <div className="flex border-b border-slate-700/50">
        <button
          onClick={() => setActiveTab("poll")}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
            activeTab === "poll" ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart2 size={16} />
          <span>Live Poll</span>
          {activeTab === "poll" && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("transcript")}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
            activeTab === "transcript" ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <MessageSquare size={16} />
          <span>Transcript</span>
          {activeTab === "transcript" && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence mode="wait">
          {selectedNode ? (
            renderNodeContent()
          ) : activeTab === "poll" ? (
            <motion.div
              key="poll"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex flex-col"
            >
              {activePoll ? (
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 block">
                    Current Question
                  </span>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                      {activePoll.conceptLabel}
                    </span>
                  </div>
                  <h3 className="text-base text-slate-200 font-medium mb-4 leading-snug">
                    {activePoll.question}
                  </h3>

                  {!pollSubmitted ? (
                    <div className="space-y-3">
                      <textarea
                        className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-32 text-sm"
                        placeholder="Type your answer here..."
                        value={pollAnswer}
                        onChange={(e) => setPollAnswer(e.target.value)}
                      />
                      <button
                        onClick={handlePollSubmit}
                        disabled={pollLoading || !pollAnswer.trim()}
                        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                          pollAnswer.trim()
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed"
                        }`}
                      >
                        <Send size={14} />
                        <span>{pollLoading ? "Submitting..." : "Submit Answer"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        Answer submitted!
                      </div>
                      {pollFeedback && (
                        <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                          <p className="text-sm text-slate-300 italic">{pollFeedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
                    <BarChart2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400">No active poll</p>
                  <p className="text-xs text-slate-500 mt-1">
                    A poll will appear here when the professor starts one
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              {transcriptChunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
                    <Mic className="w-5 h-5 text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400">Waiting for transcript...</p>
                  <p className="text-xs text-slate-500 mt-1">Audio will appear here once the lecture starts</p>
                </div>
              ) : (
                transcriptChunks.map((chunk, i) => {
                  const isLatest = i === transcriptChunks.length - 1;
                  return (
                    <div
                      key={chunk.id}
                      className={`p-3 rounded-lg transition-colors ${
                        isLatest ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-slate-800/30"
                      }`}
                    >
                      {chunk.timestamp != null && (
                        <span className="text-xs font-mono text-slate-500 mb-1 block">
                          {formatTimestamp(chunk.timestamp)}
                        </span>
                      )}
                      {chunk.speakerName && (
                        <span className="font-medium text-slate-500 text-xs uppercase tracking-wide">
                          {chunk.speakerName}:{" "}
                        </span>
                      )}
                      <p className={`text-sm leading-relaxed ${isLatest ? "text-blue-100" : "text-slate-400"}`}>
                        {chunk.text}
                      </p>
                      {chunk.detectedConcepts && chunk.detectedConcepts.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {chunk.detectedConcepts.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border"
                              style={{
                                borderColor: (COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray) + "40",
                                color: COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray,
                                backgroundColor: (COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray) + "10",
                              }}
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={transcriptBottomRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Perplexity AI Dialog */}
      {selectedNode && (
        <PerplexityDialog
          isOpen={perplexityOpen}
          onClose={() => setPerplexityOpen(false)}
          conceptLabel={selectedNode.label}
          conceptDescription={selectedNode.description}
          lectureContext={
            transcripts.length > 0
              ? transcripts
                  .slice(0, 3)
                  .map((t) => `[${formatTimestamp(t.timestamp_sec)}] ${t.text}`)
                  .join("\n\n")
              : undefined
          }
        />
      )}
    </div>
  );
}
