"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Hardcoded until Person 1's GET /api/courses/:id/students is available
const MOCK_STUDENTS = [
  { id: "student-alex", name: "Alex" },
  { id: "student-jordan", name: "Jordan" },
  { id: "student-sam", name: "Sam" },
  { id: "student-taylor", name: "Taylor" },
];

export default function LandingPage() {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState("");

  function handleStudentGo() {
    if (!selectedStudentId) return;
    localStorage.setItem("studentId", selectedStudentId);
    document.cookie = `studentId=${selectedStudentId};path=/`;
    router.push(`/student/${selectedStudentId}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-5xl font-bold tracking-tight">Prereq</h1>
        <p className="text-muted-foreground">Live classroom companion</p>

        <div className="flex items-center gap-3">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_STUDENTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleStudentGo} disabled={!selectedStudentId}>
            Join
          </Button>
        </div>

        <Button variant="outline" onClick={() => router.push("/professor/dashboard")}>
          Professor Mode
        </Button>
      </div>
    </div>
  );
}
