"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flaskApi } from "@/lib/api";

interface Student {
  id: string;
  name: string;
  email?: string;
}

interface Course {
  id: string;
  name: string;
}

export default function LandingPage() {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    flaskApi
      .get("/api/courses")
      .then((courses: Course[]) => {
        if (courses.length === 0) return;
        const cid = courses[0].id;
        setCourseId(cid);
        return flaskApi.get(`/api/courses/${cid}/students`);
      })
      .then((data: Student[] | undefined) => {
        if (data) setStudents(data);
      })
      .catch(() => {
        // Flask not running — show empty state
      })
      .finally(() => setLoading(false));
  }, []);

  function handleStudentGo() {
    if (!selectedStudentId || !courseId) return;
    localStorage.setItem("studentId", selectedStudentId);
    localStorage.setItem("courseId", courseId);
    document.cookie = `studentId=${selectedStudentId};path=/`;
    router.push(`/student/${selectedStudentId}`);
  }

  function handleProfessor() {
    if (courseId) {
      localStorage.setItem("courseId", courseId);
    }
    router.push("/professor/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-5xl font-bold tracking-tight">Prereq</h1>
        <p className="text-muted-foreground">Live classroom companion</p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No students found. Run the seed script first.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
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
        )}

        <Button variant="outline" onClick={handleProfessor}>
          Professor Mode
        </Button>
      </div>
    </div>
  );
}
