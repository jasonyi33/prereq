"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import TranscriptFeed, { type TranscriptChunk } from "@/components/dashboard/TranscriptFeed";
import ConceptHeatmap, { type HeatmapConcept } from "@/components/dashboard/ConceptHeatmap";
import ConceptTimeline, { type TimelineConcept } from "@/components/dashboard/ConceptTimeline";
import StudentList, { type StudentSummary } from "@/components/dashboard/StudentList";
import PollControls from "@/components/dashboard/PollControls";
import InterventionPanel from "@/components/dashboard/InterventionPanel";

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
  const [transcriptChunks] = useState<TranscriptChunk[]>(MOCK_TRANSCRIPT);
  const [timelineConcepts] = useState<TimelineConcept[]>([
    { id: "c1", label: "Gradient Descent", color: "green" },
    { id: "c3", label: "Loss Functions", color: "green" },
    { id: "c2", label: "Backpropagation", color: "red" },
  ]);

  const strugglingConceptIds = MOCK_HEATMAP
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
          <ConceptHeatmap concepts={MOCK_HEATMAP} totalStudents={30} />
        </div>

        {/* Right: Student list */}
        <div className="w-1/5 border-l p-2 flex flex-col">
          <StudentList students={MOCK_STUDENTS} />
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
