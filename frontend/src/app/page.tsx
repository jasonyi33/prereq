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
        <div className="relative z-10 text-gray-400 text-sm font-light tracking-wide">Loading...</div>
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
              <h2 className="text-lg font-medium text-gray-800 tracking-tight">Create Your Course</h2>
              <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Sign out</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Welcome, {profile?.name || "Professor"}! Create a course to get started.</p>
            <CreateCourseForm onCreated={() => router.push("/professor/upload")} />
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
              <h2 className="text-lg font-medium text-gray-800 tracking-tight">
                {enrollments.length > 0 ? "Your Courses" : "Join a Course"}
              </h2>
              <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Sign out</button>
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
                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-white/60 hover:bg-white transition-all group"
                  >
                    <div className="font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{e.course_name}</div>
                    <div className="text-xs text-gray-400 mt-1">Click to join lecture</div>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">
                  {enrollments.length > 0 ? "Join another course" : "Enter join code"}
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CS229M"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 uppercase tracking-wider font-mono placeholder:text-gray-300"
                  maxLength={8}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <PrimaryButton type="submit" disabled={enrolling || !joinCode.trim()}>
                {enrolling ? "Joining..." : "Join Course"}
              </PrimaryButton>
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
          <h1
            className="font-[family-name:var(--font-instrument-serif)] text-7xl sm:text-8xl text-gray-800 tracking-tight mb-6 animate-[fadeInUp_0.7s_ease-out_0.1s_both]"
            style={{ letterSpacing: "-0.03em" }}
          >
            prereq
          </h1>
          <p className="text-lg sm:text-2xl text-gray-500 tracking-tight mb-12 animate-[fadeInUp_0.7s_ease-out_0.25s_both] font-light">
            Real-time knowledge graphs for every lecture
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="px-12 py-4 rounded-full border border-gray-300 text-gray-600 font-medium text-base hover:bg-gray-800 hover:text-white hover:border-gray-800 active:scale-[0.97] transition-all duration-300 animate-[fadeInUp_0.7s_ease-out_0.4s_both]"
          >
            Get Started
          </button>
          {/* Dev shortcut for local testing */}
          {/*{process.env.NODE_ENV === 'development' && (*/}
          {/*  <button*/}
          {/*    onClick={() => {*/}
          {/*      localStorage.setItem("courseId", "test-course");*/}
          {/*      localStorage.setItem("studentId", "sam");*/}
          {/*      localStorage.setItem("mockMode", "true");*/}
          {/*      router.push("/student/sam/study-group");*/}
          {/*    }}*/}
          {/*    className="mt-4 px-6 py-2 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"*/}
          {/*  >*/}
          {/*    [Dev] Test Study Groups*/}
          {/*  </button>*/}
          {/*)}*/}
            <div className="flex items-center gap-8 mt-16 animate-[fadeInUp_0.7s_ease-out_0.55s_both]">
          <span className="text-sm text-gray-500 uppercase tracking-wider">Works with</span>
          <img src="/zoom-logo.png" alt="Zoom" className="h-10 opacity-80" />
          <img src="/perplexity-logo.png" alt="Perplexity" className="h-10 opacity-80" />
          <img src="/render-logo.png" alt="Render" className="h-10 opacity-80" />
          <img src="/anthropic-logo.png" alt="Anthropic" className="h-12 opacity-80" />
          <img src="/stanford-logo.png" alt="Anthropic" className="h-12 opacity-80" />
          <img src="/purdue-logo.png" alt="Purdue" className="h-12 opacity-70" />
          <img src="/berkeley-logo.png" alt="Berkeley" className="h-12 opacity-80" />
        </div>
        </div>
        <style jsx>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
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
          <div className="flex gap-1 mb-6 bg-gray-100/80 p-1 rounded-full">
            <TabButton active={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>
              Sign In
            </TabButton>
            <TabButton active={mode === "signup"} onClick={() => { setMode("signup"); setError(""); }}>
              Sign Up
            </TabButton>
          </div>

          {/* Role toggle */}
          <div className="flex gap-1 mb-5 bg-gray-100/80 p-1 rounded-full">
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
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 placeholder:text-gray-300"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={roleToggle === "teacher" ? "professor@stanford.edu" : "student@stanford.edu"}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 placeholder:text-gray-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 placeholder:text-gray-300"
                required
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <PrimaryButton type="submit" disabled={submitting}>
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? `Sign In as ${roleToggle === "teacher" ? "Professor" : "Student"}`
                  : "Create Account"}
            </PrimaryButton>
          </form>

          {/* Compatible with Zoom */}
          <div className="flex items-center justify-center gap-2 mt-6 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-300">
              <rect x="1" y="5" width="15" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 10l5-3v10l-5-3V10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="text-xs text-gray-400 tracking-wide">Compatible with Zoom</span>
          </div>

        </GlassCard>

        <button
          onClick={() => setShowAuth(false)}
          className="flex items-center justify-center gap-1 mx-auto mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
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
      <h1
        className="font-[family-name:var(--font-instrument-serif)] text-5xl text-gray-800 tracking-tight mb-2"
        style={{ letterSpacing: "-0.02em" }}
      >
        prereq
      </h1>
      <p className="text-sm text-gray-500 tracking-wide font-light">
        Real-time knowledge graphs for every lecture
      </p>
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/70 border border-gray-200/80 backdrop-blur-2xl p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)]">
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
        active
          ? "bg-white text-gray-700 shadow-sm"
          : "text-gray-400 hover:text-gray-500"
      }`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-800 disabled:active:scale-100"
    >
      {children}
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
      onCreated();
      refreshProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-1.5">Course name</label>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="CS229 Machine Learning"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 placeholder:text-gray-300"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-500 mb-1.5">Description (optional)</label>
        <input
          type="text"
          value={courseDesc}
          onChange={(e) => setCourseDesc(e.target.value)}
          placeholder="Stanford CS229"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 placeholder:text-gray-300"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <PrimaryButton type="submit" disabled={creating || !courseName.trim()}>
        {creating ? "Creating..." : "Create Course"}
      </PrimaryButton>
    </form>
  );
}
