"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import TranscriptFeed, { type TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
import ConceptHeatmap, { type HeatmapConcept } from "@/components/dashboard/ConceptHeatmap";
import ConceptTimeline, { type TimelineConcept } from "@/components/dashboard/ConceptTimeline";
import StudentList, { type StudentSummary } from "@/components/dashboard/StudentList";
import PollControls from "@/components/dashboard/PollControls";
import InterventionPanel from "@/components/dashboard/InterventionPanel";
import ZoomSettingsDialog from "@/components/dashboard/ZoomSettingsDialog";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { flaskApi, nextApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";


export default function ProfessorDashboard() {
  const router = useRouter();
  const { user, profile, role, courses: authCourses, signOut } = useAuth();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [timelineConcepts, setTimelineConcepts] = useState<TimelineConcept[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapConcept[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [demoStarting, setDemoStarting] = useState(false);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [zoomSettingsOpen, setZoomSettingsOpen] = useState(false);

  const socket = useSocket();

  // Load course ID from auth context, then localStorage, then API
  useEffect(() => {
    if (authCourses.length > 0) {
      setCourseId(authCourses[0].id);
      setJoinCode(authCourses[0].join_code || null);
      localStorage.setItem("courseId", authCourses[0].id);
      return;
    }
    const stored = localStorage.getItem("courseId");
    if (stored) {
      setCourseId(stored);
      return;
    }
    flaskApi
      .get("/api/courses")
      .then((courses: { id: string; join_code?: string }[]) => {
        if (courses.length > 0) {
          setCourseId(courses[0].id);
          setJoinCode(courses[0].join_code || null);
          localStorage.setItem("courseId", courses[0].id);
        }
      })
      .catch(() => {});
  }, [authCourses]);

  // Fetch heatmap data
  useEffect(() => {
    if (!courseId) return;
    flaskApi
      .get(`/api/courses/${courseId}/heatmap`)
      .then((data: { concepts: HeatmapConcept[]; total_students: number }) => {
        if (data.concepts) setHeatmapData(data.concepts);
        if (data.total_students) setTotalStudents(data.total_students);
      })
      .catch(() => {});
  }, [courseId]);

  // Fetch students with mastery distributions (single batch endpoint)
  useEffect(() => {
    if (!courseId) return;
    flaskApi
      .get(`/api/courses/${courseId}/students/summary`)
      .then((summaries: StudentSummary[]) => {
        setStudents(summaries);
      })
      .catch(() => {});
  }, [courseId]);

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
          }
        })
        .catch(() => {});
    };

    checkLiveLecture();
    const interval = setInterval(checkLiveLecture, 5000);
    return () => clearInterval(interval);
  }, [courseId]);

  // Join lecture room as professor
  useEffect(() => {
    if (lectureId) {
      socket.emit("lecture:join", { lectureId, role: "professor" });
    }
  }, [socket, lectureId]);

  // Start Demo: create lecture → simulator auto-starts (DEMO_MODE=true)
  async function handleStartDemo() {
    if (!courseId || demoStarting) return;
    setDemoStarting(true);
    try {
      const data = await nextApi.post("/api/lectures", {
        courseId,
        title: "CS229 Lecture — Neural Networks & Backpropagation",
      });
      setLectureId(data.id);
      localStorage.setItem("lectureId", data.id);
    } catch (err) {
      console.error("Failed to start demo:", err);
    } finally {
      setDemoStarting(false);
    }
  }

  // Socket: transcript:chunk
  useSocketEvent<{ text: string; timestamp: number; speakerName?: string; detectedConcepts?: { id: string; label: string }[] }>(
    "transcript:chunk",
    useCallback((data) => {
      setTranscriptChunks((prev) => [
        ...prev,
        {
          id: `tc-${Date.now()}`,
          text: data.text,
          timestamp: data.timestamp,
          speakerName: data.speakerName,
          detectedConcepts: data.detectedConcepts,
        },
      ]);
      if (data.detectedConcepts && data.detectedConcepts.length > 0) {
        setActiveConceptId(data.detectedConcepts[data.detectedConcepts.length - 1].id);
        setTimelineConcepts((prev) => {
          const existing = new Set(prev.map((c) => c.id));
          const newConcepts = data.detectedConcepts!
            .filter((c) => !existing.has(c.id))
            .map((c) => ({ id: c.id, label: c.label }));
          return [...prev, ...newConcepts];
        });
      }
    }, []),
  );

  // Socket: lecture:concept-detected
  useSocketEvent<{ conceptId: string; label: string }>(
    "lecture:concept-detected",
    useCallback((data) => {
      setActiveConceptId(data.conceptId);
      setTimelineConcepts((prev) => {
        if (prev.some((c) => c.id === data.conceptId)) return prev;
        return [...prev, { id: data.conceptId, label: data.label }];
      });
    }, []),
  );

  // Socket: poll:closed
  useSocketEvent<{ pollId: string; results: unknown }>(
    "poll:closed",
    useCallback(() => {
      // PollControls handles its own state; refresh heatmap
      if (courseId) {
        flaskApi
          .get(`/api/courses/${courseId}/heatmap`)
          .then((data: { concepts: HeatmapConcept[]; total_students: number }) => {
            if (data.concepts) setHeatmapData(data.concepts);
          })
          .catch(() => {});
      }
    }, [courseId]),
  );

  // Socket: heatmap:updated — re-fetch from Flask
  useSocketEvent<{ conceptId: string }>(
    "heatmap:updated",
    useCallback(() => {
      if (!courseId) return;
      flaskApi
        .get(`/api/courses/${courseId}/heatmap`)
        .then((data: { concepts: HeatmapConcept[]; total_students: number }) => {
          if (data.concepts) setHeatmapData(data.concepts);
        })
        .catch(() => {});
    }, [courseId]),
  );

  // Socket: mastery:updated — refresh student mastery distributions
  useSocketEvent<{ studentId: string; conceptId: string; newColor: string }>(
    "mastery:updated",
    useCallback((data) => {
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== data.studentId) return s;
          // Re-fetch this student's mastery to update distribution
          flaskApi
            .get(`/api/students/${s.id}/mastery`)
            .then((mastery: { confidence: number }[]) => {
              const dist = { green: 0, lime: 0, yellow: 0, orange: 0, gray: 0 };
              for (const m of mastery) {
                const c = m.confidence;
                if (c === 0) dist.gray++;
                else if (c < 0.4) dist.orange++;
                else if (c < 0.55) dist.yellow++;
                else if (c < 0.7) dist.lime++;
                else dist.green++;
              }
              setStudents((current) =>
                current.map((cs) =>
                  cs.id === s.id ? { ...cs, masteryDistribution: dist } : cs
                )
              );
            })
            .catch(() => {});
          return s;
        })
      );
    }, []),
  );

  const strugglingConceptIds = heatmapData
    .filter((c) => c.distribution.red > 0 || c.avg_confidence < 0.5)
    .map((c) => c.id);

  return (
    <div className="flex h-screen flex-col bg-[#fafafa] relative overflow-hidden">

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-gray-200/80 px-5 h-14">
        <div className="flex items-center gap-4">
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-xl text-gray-800 tracking-tight">
            prereq
          </h1>
          <span className="text-sm text-gray-400 font-light">Professor Dashboard</span>
          {lectureId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Live</span>
            </div>
          )}
          {joinCode && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(joinCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer"
              title="Click to copy join code"
            >
              <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider font-mono">
                {codeCopied ? "Copied!" : joinCode}
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!lectureId && (
            <Button
              size="sm"
              onClick={handleStartDemo}
              disabled={!courseId || demoStarting}
              className="bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200"
            >
              {demoStarting ? "Starting..." : "Start Demo"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setZoomSettingsOpen(true)}
            className="text-gray-400 hover:text-gray-600"
            title="Zoom Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </Button>
          {user && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              Sign out
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden gap-3 p-3">
        {/* Left: Transcript */}
        <div className="w-1/4 flex flex-col">
          <TranscriptFeed chunks={transcriptChunks} />
        </div>

        {/* Center: Heatmap */}
        <div className="flex-1 flex flex-col">
          <ConceptHeatmap concepts={heatmapData} totalStudents={totalStudents} activeConceptId={activeConceptId} />
        </div>

        {/* Right: Student list */}
        <div className="w-1/5 flex flex-col">
          <StudentList students={students} />
        </div>
      </div>

      {/* Bottom: Timeline + Controls */}
      <div className="relative z-10 bg-white/80 backdrop-blur-sm border-t border-gray-200/80">
        <div className="border-b border-gray-100 px-5">
          <ConceptTimeline concepts={timelineConcepts} />
        </div>
        <div className="grid grid-cols-2 gap-3 p-3">
          <PollControls lectureId={lectureId} />
          <InterventionPanel lectureId={lectureId} strugglingConceptIds={strugglingConceptIds} timelineConceptIds={timelineConcepts.map(c => c.id)} transcriptChunkCount={transcriptChunks.length} />
        </div>
      </div>

      {/* Zoom Settings Dialog */}
      {profile?.id && (
        <ZoomSettingsDialog
          open={zoomSettingsOpen}
          onOpenChange={setZoomSettingsOpen}
          teacherId={profile.id}
        />
      )}
    </div>
  );
}
