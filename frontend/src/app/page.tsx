"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flaskApi } from "@/lib/api";
import StarsBackground from "@/components/ui/StarsBackground";

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
  const [mode, setMode] = useState<"student" | "professor">("student");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    flaskApi
      .get("/api/courses")
      .then((courses: Course[]) => {
        if (courses.length === 0) return;
        const cid = courses[0].id;
        setCourseId(cid);
        setCourseName(courses[0].name);
        return flaskApi.get(`/api/courses/${cid}/students`);
      })
      .then((data: Student[] | undefined) => {
        if (data) setStudents(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleStudentGo() {
    if (!selectedStudentId || !courseId) return;
    setEntering(true);
    localStorage.setItem("studentId", selectedStudentId);
    localStorage.setItem("courseId", courseId);
    document.cookie = `studentId=${selectedStudentId};path=/`;
    router.push(`/student/${selectedStudentId}`);
  }

  function handleProfessor() {
    setEntering(true);
    if (courseId) localStorage.setItem("courseId", courseId);
    router.push("/professor/dashboard");
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <StarsBackground />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Header */}
        <div className="text-center mb-10">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 shadow-lg shadow-blue-500/20 mb-6">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1
            className="text-5xl font-bold text-slate-800 tracking-tight mb-3"
            style={{ letterSpacing: "-0.04em" }}
          >
            Prereq
          </h1>
          <p className="text-lg text-slate-500 tracking-tight">
            Live classroom companion
          </p>
          {courseName && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mt-4 rounded-full bg-white/80 border border-slate-200 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-slate-600">{courseName}</span>
            </div>
          )}
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl bg-white/70 border border-slate-200/80 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          {/* Tab Toggle */}
          <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-full">
            <button
              type="button"
              onClick={() => setMode("student")}
              className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
                mode === "student"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setMode("professor")}
              className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
                mode === "professor"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Professor
            </button>
          </div>

          {mode === "student" ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Select your name
                </label>
                {loading ? (
                  <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ) : students.length === 0 ? (
                  <p className="text-sm text-slate-400 py-3">
                    No students found. Run the seed script first.
                  </p>
                ) : (
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="w-full bg-white border-slate-200 text-slate-800 focus:ring-blue-500/30 focus:border-blue-400">
                      <SelectValue placeholder="Choose student..." />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <button
                onClick={handleStudentGo}
                disabled={!selectedStudentId || entering}
                className="group relative overflow-hidden w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-md"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <span className="relative flex items-center justify-center gap-2">
                  {entering ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Joining...
                    </>
                  ) : (
                    <>
                      Join Lecture
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">
                  Access the live dashboard with heatmap, poll controls, and real-time transcript.
                </p>
              </div>

              <button
                onClick={handleProfessor}
                disabled={entering}
                className="group relative overflow-hidden w-full py-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 text-slate-700 font-semibold text-sm shadow-sm hover:shadow-md hover:shadow-blue-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {entering ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Opening...
                    </>
                  ) : (
                    <>
                      Open Dashboard
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Personalized knowledge graphs for every student
        </p>
      </div>
    </div>
  );
}
