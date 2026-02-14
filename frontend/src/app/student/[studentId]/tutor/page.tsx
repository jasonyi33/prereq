"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import WeakConceptsSidebar, { type WeakConcept } from "@/components/tutor/WeakConceptsSidebar";
import ChatInterface, { type ChatMessage } from "@/components/tutor/ChatInterface";
import { useSocketEvent } from "@/lib/socket";
import { nextApi } from "@/lib/api";
import { confidenceToColor } from "@/lib/colors";

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
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Starting tutoring session...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-lg font-semibold">Tutoring Session</h1>
        {notification && (
          <p className="text-sm text-green-500 animate-pulse">{notification}</p>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Weak concepts sidebar */}
        <div className="w-1/5 border-r p-2">
          <WeakConceptsSidebar concepts={weakConcepts} />
        </div>

        {/* Right: Chat interface */}
        <div className="flex-1">
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
