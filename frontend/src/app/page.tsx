"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { flaskApi } from "@/lib/api";
import StarsBackground from "@/components/ui/StarsBackground";

export default function LandingPage() {
  const router = useRouter();
  const { user, role, profile, courses, enrollments, loading, signIn, signUp, signOut } = useAuth();

  const [showAuth, setShowAuth] = useState(false);
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

  // --- Unauthenticated ---

  // Splash screen: logo + "Get Started"
  if (!showAuth) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarsBackground />
        <div className="relative z-10 flex flex-col items-center px-6">
          <div
            className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-green-500 shadow-2xl shadow-blue-500/30 mb-8 animate-[fadeInScale_0.6s_ease-out]"
          >
            <span className="text-white font-bold text-4xl">P</span>
          </div>
          <h1
            className="text-6xl font-bold text-slate-800 tracking-tight mb-4 animate-[fadeInUp_0.6s_ease-out_0.15s_both]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Prereq
          </h1>
          <p className="text-lg text-slate-500 tracking-tight mb-12 animate-[fadeInUp_0.6s_ease-out_0.3s_both]">
            Live classroom companion
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="group relative overflow-hidden px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 animate-[fadeInUp_0.6s_ease-out_0.45s_both]"
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="relative flex items-center gap-2">
              Get Started
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </button>
          <p className="text-center text-xs text-slate-400 mt-16 animate-[fadeInUp_0.6s_ease-out_0.6s_both]">
            Personalized knowledge graphs for every student
          </p>
        </div>
        <style jsx>{`
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // Login / Signup form
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <StarsBackground />
      <div className="relative z-10 w-full max-w-md px-6 animate-[fadeInUp_0.4s_ease-out]">
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

          {/* Role toggle — shown for both login and signup */}
          <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-full">
            <TabButton active={roleToggle === "student"} onClick={() => setRoleToggle("student")}>
              Student
            </TabButton>
            <TabButton active={roleToggle === "teacher"} onClick={() => setRoleToggle("teacher")}>
              Professor
            </TabButton>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === "signup" && (
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
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={roleToggle === "teacher" ? "professor@stanford.edu" : "student@stanford.edu"}
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
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? `Sign In as ${roleToggle === "teacher" ? "Professor" : "Student"}`
                  : "Create Account"}
            </GradientButton>
          </form>

          {/* Demo quick-access divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Demo Access</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Demo buttons for quick access without auth */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                router.push("/professor/dashboard");
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Professor
            </button>
            <button
              onClick={() => {
                localStorage.setItem("studentId", "student-sam");
                document.cookie = "studentId=student-sam;path=/";
                router.push("/student/student-sam");
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
              </svg>
              Student
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowAuth(false)}
          className="flex items-center justify-center gap-1 mx-auto mt-6 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </button>
      </div>
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
