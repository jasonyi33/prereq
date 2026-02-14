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
    setShowAuth(true);
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

  // --- Authenticated: Teacher with no courses ---
  if (user && role === "teacher" && courses.length === 0) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarsBackground />
        <div className="relative z-10 w-full max-w-md px-6">
          <Header />
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Create Your Course</h2>
              <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Sign out</button>
            </div>
            <p className="text-sm text-slate-400 mb-4">Welcome, {profile?.name || "Professor"}! Create a course to get started.</p>
            <CreateCourseForm onCreated={() => router.push("/professor/dashboard")} />
          </GlassCard>
        </div>
      </div>
    );
  }

  // --- Authenticated: Student ---
  if (user && role === "student") {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarsBackground />
        <div className="relative z-10 w-full max-w-md px-6">
          <Header />
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {enrollments.length > 0 ? "Your Courses" : "Join a Course"}
              </h2>
              <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Sign out</button>
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
                    className="w-full text-left p-4 rounded-xl border border-white/[0.06] hover:border-blue-500/30 bg-white/[0.03] hover:bg-white/[0.06] transition-all group"
                  >
                    <div className="font-medium text-slate-200 group-hover:text-white transition-colors">{e.course_name}</div>
                    <div className="text-xs text-slate-500 mt-1">Click to join lecture</div>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  {enrollments.length > 0 ? "Join another course" : "Enter join code"}
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CS229M"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 uppercase tracking-wider font-mono placeholder:text-slate-600"
                  maxLength={8}
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <GradientButton type="submit" disabled={enrolling || !joinCode.trim()}>
                {enrolling ? "Joining..." : "Join Course"}
              </GradientButton>
            </form>
          </GlassCard>
        </div>
      </div>
    );
  }

  // --- Unauthenticated: Splash ---
  if (!showAuth) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <StarsBackground />
        <div className="relative z-10 flex flex-col items-center px-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/30 mb-8 animate-[fadeInScale_0.6s_ease-out] border border-white/10">
            <span className="text-white font-bold text-4xl drop-shadow-lg">P</span>
          </div>
          <h1
            className="text-6xl font-bold text-white tracking-tight mb-4 animate-[fadeInUp_0.6s_ease-out_0.15s_both]"
            style={{ letterSpacing: "-0.04em" }}
          >
            Prereq
          </h1>
          <p className="text-lg text-slate-400 tracking-tight mb-12 animate-[fadeInUp_0.6s_ease-out_0.3s_both]">
            Live classroom companion
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="group relative overflow-hidden px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-base shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 animate-[fadeInUp_0.6s_ease-out_0.45s_both] border border-white/10"
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <span className="relative flex items-center gap-2">
              Get Started
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </button>
          <p className="text-center text-xs text-slate-600 mt-16 animate-[fadeInUp_0.6s_ease-out_0.6s_both]">
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

  // --- Unauthenticated: Login / Signup ---
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <StarsBackground />
      <div className="relative z-10 w-full max-w-md px-6 animate-[fadeInUp_0.4s_ease-out]">
        <Header />

        <GlassCard>
          {/* Login / Signup toggle */}
          <div className="flex gap-1 mb-6 bg-white/[0.04] p-1 rounded-full border border-white/[0.06]">
            <TabButton active={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>
              Sign In
            </TabButton>
            <TabButton active={mode === "signup"} onClick={() => { setMode("signup"); setError(""); }}>
              Sign Up
            </TabButton>
          </div>

          {/* Role toggle */}
          <div className="flex gap-1 mb-5 bg-white/[0.04] p-1 rounded-full border border-white/[0.06]">
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
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/30 placeholder:text-slate-600"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={roleToggle === "teacher" ? "professor@stanford.edu" : "student@stanford.edu"}
                className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/30 placeholder:text-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/30 placeholder:text-slate-600"
                required
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <GradientButton type="submit" disabled={submitting}>
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? `Sign In as ${roleToggle === "teacher" ? "Professor" : "Student"}`
                  : "Create Account"}
            </GradientButton>
          </form>

          {/* Demo quick-access */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-slate-700/50" />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Demo Access</span>
            <div className="h-px flex-1 bg-slate-700/50" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/professor/dashboard")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.06] text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.06] text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" />
              </svg>
              Student
            </button>
          </div>
        </GlassCard>

        <button
          onClick={() => setShowAuth(false)}
          className="flex items-center justify-center gap-1 mx-auto mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
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
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-6 border border-white/10">
        <span className="text-white font-bold text-2xl drop-shadow-lg">P</span>
      </div>
      <h1 className="text-5xl font-bold text-white tracking-tight mb-3" style={{ letterSpacing: "-0.04em" }}>
        Prereq
      </h1>
      <p className="text-lg text-slate-400 tracking-tight">Live classroom companion</p>
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-2xl p-8 shadow-2xl shadow-black/30">
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-white/[0.08] text-white shadow-sm shadow-white/[0.03] border border-white/[0.1] backdrop-blur-sm"
          : "text-slate-500 hover:text-slate-300"
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
      className="group relative overflow-hidden w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-md border border-white/10"
    >
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Course name</label>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="CS229 Machine Learning"
          className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/30 placeholder:text-slate-600"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Description (optional)</label>
        <input
          type="text"
          value={courseDesc}
          onChange={(e) => setCourseDesc(e.target.value)}
          placeholder="Stanford CS229"
          className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400/30 placeholder:text-slate-600"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <GradientButton type="submit" disabled={creating || !courseName.trim()}>
        {creating ? "Creating..." : "Create Course"}
      </GradientButton>
    </form>
  );
}
