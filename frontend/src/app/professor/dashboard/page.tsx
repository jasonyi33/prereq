"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import TranscriptFeed, { type TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
import ConceptHeatmap, { type HeatmapConcept } from "@/components/dashboard/ConceptHeatmap";
import ConceptTimeline, { type TimelineConcept } from "@/components/dashboard/ConceptTimeline";
import StudentList, { type StudentSummary } from "@/components/dashboard/StudentList";
import PollControls from "@/components/dashboard/PollControls";
import InterventionPanel from "@/components/dashboard/InterventionPanel";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { flaskApi, nextApi } from "@/lib/api";

function confidenceToColor(confidence: number): string {
  if (confidence === 0) return "gray";
  if (confidence < 0.4) return "red";
  if (confidence < 0.7) return "yellow";
  return "green";
}

export default function ProfessorDashboard() {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [timelineConcepts, setTimelineConcepts] = useState<TimelineConcept[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapConcept[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [demoStarting, setDemoStarting] = useState(false);

  const socket = useSocket();

  // Load course ID from localStorage or fetch from API
  useEffect(() => {
    const stored = localStorage.getItem("courseId");
    if (stored) {
      setCourseId(stored);
      return;
    }
    flaskApi
      .get("/api/courses")
      .then((courses: { id: string }[]) => {
        if (courses.length > 0) {
          setCourseId(courses[0].id);
          localStorage.setItem("courseId", courses[0].id);
        }
      })
      .catch(() => {});
  }, []);

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

  // Fetch students with mastery distributions
  useEffect(() => {
    if (!courseId) return;
    flaskApi
      .get(`/api/courses/${courseId}/students`)
      .then(async (studentList: { id: string; name: string }[]) => {
        const summaries: StudentSummary[] = await Promise.all(
          studentList.map(async (s) => {
            try {
              const mastery: { confidence: number }[] = await flaskApi.get(
                `/api/students/${s.id}/mastery`
              );
              const dist = { green: 0, yellow: 0, red: 0, gray: 0 };
              for (const m of mastery) {
                dist[confidenceToColor(m.confidence) as keyof typeof dist]++;
              }
              return { id: s.id, name: s.name, masteryDistribution: dist };
            } catch {
              return { id: s.id, name: s.name, masteryDistribution: { green: 0, yellow: 0, red: 0, gray: 0 } };
            }
          })
        );
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
      if (data.detectedConcepts) {
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
              const dist = { green: 0, yellow: 0, red: 0, gray: 0 };
              for (const m of mastery) {
                dist[confidenceToColor(m.confidence) as keyof typeof dist]++;
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
    .filter((c) => c.distribution.red > c.distribution.green)
    .map((c) => c.id);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold">Professor Dashboard</h1>
        {lectureId ? (
          <span className="text-sm text-green-500">Live</span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartDemo}
            disabled={!courseId || demoStarting}
          >
            {demoStarting ? "Starting..." : "Start Demo"}
          </Button>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="w-1/4 border-r p-2 flex flex-col">
          <TranscriptFeed chunks={transcriptChunks} />
        </div>

        {/* Center: Heatmap */}
        <div className="flex-1 p-2 flex flex-col">
          <ConceptHeatmap concepts={heatmapData} totalStudents={totalStudents} />
        </div>

        {/* Right: Student list */}
        <div className="w-1/5 border-l p-2 flex flex-col">
          <StudentList students={students} />
        </div>
      </div>

      {/* Bottom: Timeline + Controls */}
      <div className="border-t">
        <div className="border-b px-4">
          <ConceptTimeline concepts={timelineConcepts} />
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          <PollControls lectureId={lectureId} />
          <InterventionPanel lectureId={lectureId} strugglingConceptIds={strugglingConceptIds} />
        </div>
      </div>
    </div>
  );
}
