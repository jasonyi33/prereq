"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface AuthUser {
  id: string;
  email: string;
}

interface Enrollment {
  student_id: string;
  course_id: string;
  course_name: string;
}

interface TeacherCourse {
  id: string;
  name: string;
  description?: string;
  join_code?: string;
}

interface Profile {
  name: string;
  email: string;
  id?: string;
}

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  role: "teacher" | "student" | "unknown" | null;
  courses: TeacherCourse[];
  enrollments: Enrollment[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string, role: "teacher" | "student") => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  role: null,
  courses: [],
  enrollments: [],
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://localhost:5000";

async function flaskFetch(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "1",
    ...((options?.headers as Record<string, string>) || {}),
  };
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${FLASK_API_URL}${path}`, { ...options, headers });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<"teacher" | "student" | "unknown" | null>(null);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const res = await flaskFetch("/api/auth/me");
    if (!res.ok) {
      // Token is invalid/expired — clear it
      localStorage.removeItem("token");
      return false;
    }
    const data = await res.json();
    setRole(data.role);
    setProfile(data.profile);
    setCourses(data.courses || []);
    setEnrollments(data.enrollments || []);
    return true;
  }, []);

  // On mount: check localStorage for existing token, restore session via /api/auth/me
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    // We have a token — try to restore the session
    loadProfile()
      .then((ok) => {
        if (ok) {
          // Decode user info from the token (JWT payload)
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            setUser({ id: payload.sub, email: payload.email || "" });
          } catch {
            // Can't decode — clear
            localStorage.removeItem("token");
          }
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await flaskFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Login failed" };

    localStorage.setItem("token", data.access_token);
    setUser(data.user);
    setRole(data.role);
    setProfile(data.profile);
    setCourses(data.courses || []);
    setEnrollments(data.enrollments || []);
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, role: "teacher" | "student") => {
    const res = await flaskFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name, role }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Signup failed" };

    localStorage.setItem("token", data.access_token);
    setUser(data.user);
    setRole(data.role);

    // Load full profile (signup response is minimal)
    await loadProfile();
    return {};
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await flaskFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best effort
    }
    localStorage.removeItem("token");
    localStorage.removeItem("courseId");
    localStorage.removeItem("studentId");
    localStorage.removeItem("lectureId");
    setUser(null);
    setProfile(null);
    setRole(null);
    setCourses([]);
    setEnrollments([]);
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (token) {
      await loadProfile();
    }
  }, [loadProfile]);

  return (
    <AuthContext.Provider
      value={{ user, profile, role, courses, enrollments, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
