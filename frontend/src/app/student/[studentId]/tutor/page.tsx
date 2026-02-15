"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import WeakConceptsSidebar, { type WeakConcept } from "@/components/tutor/WeakConceptsSidebar";
import ChatInterface, { type ChatMessage } from "@/components/tutor/ChatInterface";
import { useSocketEvent } from "@/lib/socket";
import { nextApi } from "@/lib/api";
import { confidenceToColor } from "@/lib/colors";

/** Aaron logo — cute "A" in Instrument Serif, aligned with landing page style */
function AaronLogo({ className = "w-9 h-9 text-xl" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 font-[family-name:var(--font-instrument-serif)] font-normal text-gray-800 ${className}`}
      style={{ lineHeight: 1 }}
    >
      A
    </div>
  );
}

// Mock weak concepts until tutoring session endpoint is available
const MOCK_WEAK_CONCEPTS: WeakConcept[] = [
  { id: "c2", label: "Backpropagation", color: "red", confidence: 0.15 },
  { id: "c5", label: "Activation Functions", color: "red", confidence: 0.2 },
  { id: "c4", label: "Chain Rule", color: "yellow", confidence: 0.45 },
];

const MOCK_INITIAL_MESSAGE: ChatMessage = {
  id: "init-1",
  role: "assistant",
  content:
    "Hi! I'm here to help you strengthen your understanding. I noticed you're working on Backpropagation, Activation Functions, and Chain Rule. Let's start with Backpropagation — can you explain in your own words what backpropagation does in a neural network?",
};

export default function TutoringView() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [weakConcepts, setWeakConcepts] = useState<WeakConcept[]>(MOCK_WEAK_CONCEPTS);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([MOCK_INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Create tutoring session on mount
  useEffect(() => {
    nextApi
      .post("/api/tutoring/sessions", { studentId })
      .then((res) => {
        setSessionId(res.sessionId);
        if (res.targetConcepts && res.targetConcepts.length > 0) {
          setWeakConcepts(
            res.targetConcepts.map((c: WeakConcept) => ({
              ...c,
              color: c.color || confidenceToColor(c.confidence ?? 0),
            })),
          );
        }
        if (res.initialMessage) {
          setInitialMessages([
            {
              id: "init-1",
              role: res.initialMessage.role || "assistant",
              content: res.initialMessage.content,
            },
          ]);
        }
      })
      .catch(() => {
        // Use mock data with a fake session ID
        setSessionId("mock-session-1");
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  // Listen for mastery updates
  useSocketEvent<{ studentId: string; conceptId: string; newColor: string; confidence: number }>(
    "mastery:updated",
    useCallback(
      (data) => {
        if (data.studentId !== studentId) return;
        setWeakConcepts((prev) =>
          prev.map((c) =>
            c.id === data.conceptId
              ? { ...c, color: data.newColor, confidence: data.confidence }
              : c,
          ),
        );
      },
      [studentId],
    ),
  );

  function handleMasteryUpdate(updates: { conceptId: string; conceptLabel?: string; newColor: string; confidence: number }[]) {
    for (const u of updates) {
      setWeakConcepts((prev) =>
        prev.map((c) =>
          c.id === u.conceptId
            ? { ...c, color: u.newColor, confidence: u.confidence }
            : c,
        ),
      );
      const label = u.conceptLabel || weakConcepts.find((c) => c.id === u.conceptId)?.label || "a concept";
      setNotification(`Your understanding of ${label} improved!`);
      setTimeout(() => setNotification(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <AaronLogo className="w-12 h-12 text-2xl animate-pulse" />
          <p className="text-sm text-gray-500 font-medium">Starting tutoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 relative overflow-hidden font-sans">
      {/* Header — aligned with landing page */}
      <header className="relative z-10 flex items-center gap-3 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <AaronLogo />
        <div>
          <h1 className="text-xl font-[family-name:var(--font-instrument-serif)] text-gray-800 tracking-tight leading-tight">Aaron - AI Tutor</h1>
          <p className="text-xs text-gray-500 font-medium">Personalized learning session</p>
        </div>
      </header>

      {/* Notification toast */}
      {notification && (
        <div className="absolute top-16 right-4 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-lg shadow-gray-100/50">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <span className="text-sm font-medium text-gray-800">{notification}</span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden gap-3 p-3">
        {/* Left: Weak concepts sidebar */}
        <div className="w-[280px] shrink-0">
          <WeakConceptsSidebar concepts={weakConcepts} />
        </div>

        {/* Right: Chat interface */}
        <div className="flex-1 min-w-0">
          {sessionId && (
            <ChatInterface
              sessionId={sessionId}
              initialMessages={initialMessages}
              onMasteryUpdate={handleMasteryUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
