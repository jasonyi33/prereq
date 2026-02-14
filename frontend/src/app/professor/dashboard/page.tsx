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
import { flaskApi } from "@/lib/api";

// Hardcoded demo course
const COURSE_ID = "demo-course";

// Mock data until real endpoints are wired
const MOCK_HEATMAP: HeatmapConcept[] = [
  { id: "c1", label: "Gradient Descent", distribution: { green: 12, yellow: 8, red: 5, gray: 5 }, avg_confidence: 0.62 },
  { id: "c2", label: "Backpropagation", distribution: { green: 5, yellow: 6, red: 14, gray: 5 }, avg_confidence: 0.32 },
  { id: "c3", label: "Loss Functions", distribution: { green: 18, yellow: 7, red: 3, gray: 2 }, avg_confidence: 0.78 },
  { id: "c4", label: "Chain Rule", distribution: { green: 10, yellow: 10, red: 5, gray: 5 }, avg_confidence: 0.55 },
  { id: "c5", label: "Activation Functions", distribution: { green: 8, yellow: 9, red: 8, gray: 5 }, avg_confidence: 0.48 },
];

const MOCK_STUDENTS: StudentSummary[] = [
  { id: "student-alex", name: "Alex", masteryDistribution: { green: 20, yellow: 8, red: 2, gray: 5 } },
  { id: "student-jordan", name: "Jordan", masteryDistribution: { green: 12, yellow: 10, red: 8, gray: 5 } },
  { id: "student-sam", name: "Sam", masteryDistribution: { green: 5, yellow: 8, red: 15, gray: 7 } },
  { id: "student-taylor", name: "Taylor", masteryDistribution: { green: 15, yellow: 3, red: 12, gray: 5 } },
];

const MOCK_TRANSCRIPT: TranscriptChunk[] = [
  { id: "t1", text: "Today we'll cover gradient descent and how it optimizes loss functions.", speakerName: "Professor", detectedConcepts: [{ id: "c1", label: "Gradient Descent" }, { id: "c3", label: "Loss Functions" }] },
  { id: "t2", text: "The key idea is to compute the gradient of the loss with respect to each parameter.", speakerName: "Professor", detectedConcepts: [{ id: "c1", label: "Gradient Descent" }] },
  { id: "t3", text: "For neural networks, we use backpropagation to efficiently compute these gradients.", speakerName: "Professor", detectedConcepts: [{ id: "c2", label: "Backpropagation" }] },
];

export default function ProfessorDashboard() {
  const [lectureId] = useState<string | null>("mock-lecture-1");
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>(MOCK_TRANSCRIPT);
  const [timelineConcepts, setTimelineConcepts] = useState<TimelineConcept[]>([
    { id: "c1", label: "Gradient Descent", color: "green" },
    { id: "c3", label: "Loss Functions", color: "green" },
    { id: "c2", label: "Backpropagation", color: "red" },
  ]);
  const [heatmapData, setHeatmapData] = useState<HeatmapConcept[]>(MOCK_HEATMAP);
  const [students] = useState<StudentSummary[]>(MOCK_STUDENTS);

  const socket = useSocket();

  // Join lecture room as professor
  useEffect(() => {
    if (lectureId) {
      socket.emit("lecture:join", { lectureId, role: "professor" });
    }
  }, [socket, lectureId]);

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
      // Add detected concepts to timeline
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
      // PollControls handles its own state; this is for any additional dashboard updates
    }, []),
  );

  // Socket: heatmap:updated — re-fetch from Flask
  useSocketEvent<{ conceptId: string }>(
    "heatmap:updated",
    useCallback(() => {
      flaskApi
        .get(`/api/courses/${COURSE_ID}/heatmap`)
        .then((data) => {
          if (data.concepts) {
            setHeatmapData(data.concepts);
          }
        })
        .catch(() => {
          // Keep existing data
        });
    }, []),
  );

  // Socket: mastery:updated — could update student dots
  useSocketEvent<{ studentId: string; conceptId: string; newColor: string }>(
    "mastery:updated",
    useCallback(() => {
      // In a full implementation, update the specific student's mastery distribution
      // For now, the student list uses static mock data
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => console.log("Start Demo")}
        >
          Start Demo
        </Button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript */}
        <div className="w-1/4 border-r p-2 flex flex-col">
          <TranscriptFeed chunks={transcriptChunks} />
        </div>

        {/* Center: Heatmap */}
        <div className="flex-1 p-2 flex flex-col">
          <ConceptHeatmap concepts={heatmapData} totalStudents={30} />
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
