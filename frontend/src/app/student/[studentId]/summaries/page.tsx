"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, BookOpen, FileText, Mic } from "lucide-react";
import { flaskApi } from "@/lib/api";
import { confidenceToNodeBorder } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";

interface LectureSummary {
  bullets: string[];
  title_summary: string;
  covered_concept_ids: string[];
}

interface Lecture {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at?: string;
  summary?: LectureSummary;
}

interface MasteryEntry {
  concept_id: string;
  confidence: number;
  color: string;
}

interface TranscriptChunk {
  text: string;
  timestamp_sec: number;
}

interface ConceptNode {
  id: string;
  label: string;
}

export default function SummariesPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const { user, signOut } = useAuth();

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [mastery, setMastery] = useState<MasteryEntry[]>([]);
  const [conceptMap, setConceptMap] = useState<Map<string, string>>(new Map());
  const [expandedLecture, setExpandedLecture] = useState<string | null>(null);
  const [transcriptCache, setTranscriptCache] = useState<Record<string, TranscriptChunk[]>>({});
  const [loading, setLoading] = useState(true);

  const courseId = typeof window !== "undefined" ? localStorage.getItem("courseId") : null;

  // Fetch lectures, mastery, and concept labels on mount
  useEffect(() => {
    if (!courseId) return;

    Promise.all([
      flaskApi.get(`/api/courses/${courseId}/lectures`) as Promise<Lecture[]>,
      flaskApi.get(`/api/students/${studentId}/mastery`) as Promise<MasteryEntry[]>,
      flaskApi.get(`/api/courses/${courseId}/graph`) as Promise<{ nodes: ConceptNode[] }>,
    ])
      .then(([lectureData, masteryData, graphData]) => {
        const completed = lectureData.filter(
          (l) => l.status === "completed" && l.summary
        );
        setLectures(completed);
        setMastery(masteryData);

        const cMap = new Map<string, string>();
        for (const n of graphData.nodes) {
          cMap.set(n.id, n.label);
        }
        setConceptMap(cMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId, studentId]);

  // Lazy-load transcript when a lecture is expanded
  useEffect(() => {
    if (!expandedLecture || transcriptCache[expandedLecture]) return;

    flaskApi
      .get(`/api/lectures/${expandedLecture}/transcript-chunks`)
      .then((chunks: TranscriptChunk[]) => {
        setTranscriptCache((prev) => ({
          ...prev,
          [expandedLecture]: [...chunks].reverse(),
        }));
      })
      .catch(() => {});
  }, [expandedLecture]);

  // Build mastery lookup
  const masteryMap = useMemo(() => {
    const m = new Map<string, MasteryEntry>();
    for (const entry of mastery) {
      m.set(entry.concept_id, entry);
    }
    return m;
  }, [mastery]);

  function getWeakConcepts(coveredIds: string[]) {
    return coveredIds
      .map((id) => {
        const m = masteryMap.get(id);
        return {
          id,
          label: conceptMap.get(id) || "Unknown",
          confidence: m?.confidence ?? 0,
        };
      })
      .filter((c) => c.confidence > 0 && c.confidence < 0.7)
      .sort((a, b) => a.confidence - b.confidence);
  }

  function formatTimestamp(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-800 font-sans">
      {/* Header */}
      <header className="relative z-10 h-14 flex items-center justify-between px-6 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/student/${studentId}`)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-xl text-gray-800 tracking-tight">
            prereq
          </h1>
          <span className="text-xs text-gray-400 ml-1">Lecture Summaries</span>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <BookOpen className="w-8 h-8 text-gray-300 animate-pulse mb-3" />
            <p className="text-sm text-gray-400">Loading summaries...</p>
          </div>
        ) : lectures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No completed lectures yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Summaries will appear here after lectures end
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {lectures.map((lecture) => {
              const isExpanded = expandedLecture === lecture.id;
              const summary = lecture.summary!;
              const weakConcepts = getWeakConcepts(summary.covered_concept_ids || []);
              const transcript = transcriptCache[lecture.id];

              return (
                <div
                  key={lecture.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Lecture header — always visible */}
                  <button
                    onClick={() =>
                      setExpandedLecture(isExpanded ? null : lecture.id)
                    }
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {summary.title_summary || lecture.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(lecture.started_at)}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-5 border-t border-gray-100">
                      {/* Summary bullets */}
                      <div className="pt-4 space-y-2">
                        <h4 className="text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                          Summary
                        </h4>
                        <ul className="space-y-1.5">
                          {summary.bullets.map((bullet, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed"
                            >
                              <span className="text-green-400 mt-1 shrink-0">
                                &bull;
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Weak topics */}
                      {weakConcepts.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                            Topics to Review
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {weakConcepts.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border"
                                style={{
                                  borderColor:
                                    confidenceToNodeBorder(c.confidence) + "40",
                                  color: confidenceToNodeBorder(c.confidence),
                                  backgroundColor:
                                    confidenceToNodeBorder(c.confidence) + "10",
                                }}
                              >
                                {c.label} ({Math.round(c.confidence * 100)}%)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Full transcript */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-medium text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Mic size={12} />
                          Full Transcript
                        </h4>
                        {!transcript ? (
                          <p className="text-xs text-gray-400">
                            Loading transcript...
                          </p>
                        ) : transcript.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">
                            No transcript available.
                          </p>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-lg bg-gray-50 p-3 border border-gray-100">
                            {transcript.map((chunk, i) => (
                              <div key={i} className="text-xs text-gray-600">
                                <span className="font-mono text-gray-400 mr-1.5">
                                  {formatTimestamp(chunk.timestamp_sec)}
                                </span>
                                {chunk.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
