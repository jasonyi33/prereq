"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { flaskApi } from "@/lib/api";
import StarsBackground from "@/components/ui/StarsBackground";

export default function LandingPage() {
  const router = useRouter();
  const { user, role, profile, courses, enrollments, loading, signIn, signUp, signOut } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [roleToggle, setRoleToggle] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // Auto-redirect authenticated users
  useEffect(() => {
    if (loading || !user) return;
    if (role === "teacher" && courses.length > 0) {
      localStorage.setItem("courseId", courses[0].id);
      router.push("/professor/dashboard");
    }
  }, [loading, user, role, courses, router]);

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarsBackground />
        <div className="relative z-10 text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        const result = await signIn(email, password);
        if (result.error) setError(result.error);
      } else {
        if (!name.trim()) { setError("Name is required"); setSubmitting(false); return; }
        const result = await signUp(email, password, name, roleToggle);
        if (result.error) setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError("");
    setEnrolling(true);
    try {
      const result: { student_id: string; course_id: string; course_name: string } = await flaskApi.post("/api/courses/enroll", { join_code: joinCode });
      localStorage.setItem("courseId", result.course_id);
      localStorage.setItem("studentId", result.student_id);
      document.cookie = `studentId=${result.student_id};path=/`;
      router.push(`/student/${result.student_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  }

  // --- Authenticated views ---
  if (user && role === "teacher" && courses.length === 0) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarsBackground />
        <div className="relative z-10 w-full max-w-md px-6">
          <Header />
          <div className="rounded-2xl bg-white/70 border border-slate-200/80 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">Create Your Course</h2>
              <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600">Sign out</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Welcome, {profile?.name || "Professor"}! Create a course to get started.</p>
            <CreateCourseForm onCreated={() => router.push("/professor/dashboard")} />
          </div>
        </div>
      </div>
    );
  }

  if (user && role === "student") {
    // Show enrollments or join form
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarsBackground />
        <div className="relative z-10 w-full max-w-md px-6">
          <Header />
          <div className="rounded-2xl bg-white/70 border border-slate-200/80 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-800">
                {enrollments.length > 0 ? "Your Courses" : "Join a Course"}
              </h2>
              <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600">Sign out</button>
            </div>

            {enrollments.length > 0 && (
              <div className="space-y-3 mb-6">
                {enrollments.map((e) => (
                  <button
                    key={e.student_id}
                    onClick={() => {
                      localStorage.setItem("courseId", e.course_id);
                      localStorage.setItem("studentId", e.student_id);
                      document.cookie = `studentId=${e.student_id};path=/`;
                      router.push(`/student/${e.student_id}`);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                  >
                    <div className="font-medium text-slate-800">{e.course_name}</div>
                    <div className="text-xs text-slate-400 mt-1">Click to join lecture</div>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  {enrollments.length > 0 ? "Join another course" : "Enter join code"}
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CS229M"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 uppercase tracking-wider font-mono"
                  maxLength={8}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <GradientButton type="submit" disabled={enrolling || !joinCode.trim()}>
                {enrolling ? "Joining..." : "Join Course"}
              </GradientButton>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Unauthenticated: Login / Signup ---
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <StarsBackground />
      <div className="relative z-10 w-full max-w-md px-6">
        <Header />

        <div className="rounded-2xl bg-white/70 border border-slate-200/80 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          {/* Login / Signup toggle */}
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-full">
            <TabButton active={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>
              Sign In
            </TabButton>
            <TabButton active={mode === "signup"} onClick={() => { setMode("signup"); setError(""); }}>
              Sign Up
            </TabButton>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
                {/* Role toggle */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-full">
                  <TabButton active={roleToggle === "student"} onClick={() => setRoleToggle("student")}>
                    Student
                  </TabButton>
                  <TabButton active={roleToggle === "teacher"} onClick={() => setRoleToggle("teacher")}>
                    Teacher
                  </TabButton>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@stanford.edu"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                required
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <GradientButton type="submit" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </GradientButton>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Personalized knowledge graphs for every student
        </p>
      </div>
    </div>
  );
}

// --- Shared UI components ---

function Header() {
  return (
    <div className="text-center mb-10">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 shadow-lg shadow-blue-500/20 mb-6">
        <span className="text-white font-bold text-2xl">P</span>
      </div>
      <h1 className="text-5xl font-bold text-slate-800 tracking-tight mb-3" style={{ letterSpacing: "-0.04em" }}>
        Prereq
      </h1>
      <p className="text-lg text-slate-500 tracking-tight">Live classroom companion</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
        active ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function GradientButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="group relative overflow-hidden w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-md"
    >
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <span className="relative">{children}</span>
    </button>
  );
}

function CreateCourseForm({ onCreated }: { onCreated: () => void }) {
  const { refreshProfile } = useAuth();
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!courseName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const result: { id: string; join_code?: string } = await flaskApi.post("/api/courses", {
        name: courseName,
        description: courseDesc,
      });
      localStorage.setItem("courseId", result.id);
      await refreshProfile();
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">Course name</label>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="CS229 Machine Learning"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">Description (optional)</label>
        <input
          type="text"
          value={courseDesc}
          onChange={(e) => setCourseDesc(e.target.value)}
          placeholder="Stanford CS229"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <GradientButton type="submit" disabled={creating || !courseName.trim()}>
        {creating ? "Creating..." : "Create Course"}
      </GradientButton>
    </form>
  );
}
