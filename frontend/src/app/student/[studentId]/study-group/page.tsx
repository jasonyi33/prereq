"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { flaskApi } from "@/lib/api";
import { useSocket, useSocketEvent } from "@/lib/socket";
import ConceptSelector from "@/components/study-group/ConceptSelector";
import WaitingCard from "@/components/study-group/WaitingCard";
import MatchedCard from "@/components/study-group/MatchedCard";

interface ConceptOption {
  id: string;
  label: string;
  category: string;
  confidence: number;
  color: string;
}

interface MatchDetails {
  matchId: string;
  partner: { id: string; name: string; email?: string };
  conceptLabels: string[];
  zoomLink: string;
  complementarityScore: number;
}

// Mock data for testing without Supabase
const MOCK_CONCEPTS: ConceptOption[] = [
  { id: "c1", label: "Backpropagation", category: "Backpropagation", confidence: 0.1, color: "red" },
  { id: "c2", label: "Chain Rule", category: "Calculus", confidence: 0.3, color: "red" },
  { id: "c3", label: "Dropout", category: "Regularization", confidence: 0.1, color: "red" },
  { id: "c4", label: "SGD", category: "Gradient Descent", confidence: 0.15, color: "red" },
  { id: "c5", label: "Activation Functions", category: "Neural Networks", confidence: 0.2, color: "red" },
  { id: "c6", label: "L2 Regularization", category: "Regularization", confidence: 0.5, color: "yellow" },
  { id: "c7", label: "Cross-Entropy", category: "ML Foundations", confidence: 0.6, color: "yellow" },
];

const MOCK_MATCH_DETAILS: MatchDetails = {
  matchId: "mock-1",
  partner: { id: "student-alex", name: "Alex" },
  conceptLabels: ["Backpropagation", "Dropout"],
  zoomLink: "https://zoom.us/j/123456789",
  complementarityScore: 0.68
};

export default function StudyGroupPage() {
  const params = useParams();
  const router = useRouter();
  const socket = useSocket();
  const studentId = params.studentId as string;

  const [courseId, setCourseId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'matched'>('idle');
  const [concepts, setConcepts] = useState<ConceptOption[]>([]);
  const [selectedConcepts, setSelectedConcepts] = useState<Set<string>>(new Set());
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if mock mode is enabled
  const useMockData = typeof window !== 'undefined' &&
    (process.env.NEXT_PUBLIC_MOCK_MODE === "true" || localStorage.getItem("mockMode") === "true");

  // Get courseId from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("courseId");
    if (stored) {
      setCourseId(stored);
    } else {
      const interval = setInterval(() => {
        const v = localStorage.getItem("courseId");
        if (v) {
          setCourseId(v);
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  // Fetch concepts with student's mastery
  useEffect(() => {
    if (!courseId) return;

    if (useMockData) {
      setConcepts(MOCK_CONCEPTS);
      setLoading(false);
      return;
    }

    Promise.all([
      flaskApi.get(`/api/courses/${courseId}/graph?student_id=${studentId}`),
      flaskApi.get(`/api/courses/${courseId}/study-groups/status?studentId=${studentId}`)
    ])
      .then(([graphData, statusData]) => {
        // Extract concepts from graph
        const conceptOptions: ConceptOption[] = graphData.nodes.map((n: any) => ({
          id: n.id,
          label: n.label,
          category: n.category || "Other",
          confidence: n.confidence ?? 0,
          color: n.color || "gray"
        }));
        setConcepts(conceptOptions);

        // Check existing status
        if (statusData.status === 'matched') {
          setMatchDetails(statusData);
          setStatus('matched');
        } else if (statusData.status === 'waiting') {
          setStatus('waiting');
          // Try to map concept labels back to IDs
          const conceptMap = new Map(conceptOptions.map(c => [c.label, c.id]));
          const selectedIds = statusData.conceptLabels
            .map((label: string) => conceptMap.get(label))
            .filter((id: string | undefined): id is string => Boolean(id));
          setSelectedConcepts(new Set(selectedIds));
        }
      })
      .catch(err => {
        console.error("Failed to load:", err);
        setError("Failed to load data. Using mock data for demo.");
        setConcepts(MOCK_CONCEPTS);
      })
      .finally(() => setLoading(false));
  }, [courseId, studentId, useMockData]);

  // Poll status while waiting (every 3s, 30s timeout)
  useEffect(() => {
    if (status !== 'waiting' || !courseId) return;
    if (useMockData) return; // Don't poll in mock mode

    let attempts = 0;
    const maxAttempts = 10; // 30 seconds / 3s

    const interval = setInterval(() => {
      attempts++;

      flaskApi.get(`/api/courses/${courseId}/study-groups/status?studentId=${studentId}`)
        .then(data => {
          if (data.status === 'matched') {
            setMatchDetails(data);
            setStatus('matched');
            clearInterval(interval);
          } else if (attempts >= maxAttempts) {
            // Timeout: show alert and return to idle
            alert("No study partner found. Try again later or select different concepts.");
            setStatus('idle');
            clearInterval(interval);
          }
        })
        .catch(err => {
          console.error("Status check failed:", err);
        });
    }, 3000);

    return () => clearInterval(interval);
  }, [status, courseId, studentId, useMockData]);

  // Socket.IO listener for instant match notification
  useSocketEvent<MatchDetails>(
    'study-group:matched',
    useCallback((data) => {
      setMatchDetails(data);
      setStatus('matched');
    }, [])
  );

  const handleFindPartner = async () => {
    if (!courseId || selectedConcepts.size === 0) return;

    // Mock mode simulation
    if (useMockData) {
      setStatus('waiting');
      setTimeout(() => {
        setMatchDetails(MOCK_MATCH_DETAILS);
        setStatus('matched');
      }, 3000);
      return;
    }

    setLoading(true);
    try {
      const result = await flaskApi.post(`/api/courses/${courseId}/study-groups/opt-in`, {
        studentId,
        conceptIds: Array.from(selectedConcepts)
      });

      if (result.status === 'matched') {
        setMatchDetails(result);
        setStatus('matched');
      } else {
        setStatus('waiting');
      }
    } catch (err) {
      console.error("Opt-in failed:", err);
      alert("Failed to join study group pool. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!courseId) return;

    if (useMockData) {
      setStatus('idle');
      setSelectedConcepts(new Set());
      return;
    }

    try {
      await flaskApi.post(`/api/courses/${courseId}/study-groups/opt-out`, { studentId });
      setStatus('idle');
      setSelectedConcepts(new Set());
    } catch (err) {
      console.error("Opt-out failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center animate-pulse">
            <Users className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 relative overflow-hidden">
      {/* Background blur blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-blue-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-purple-200/15 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 bg-white/70 backdrop-blur-sm border-b border-slate-200 px-4 py-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Users className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800 tracking-tight leading-tight">Study Groups</h1>
          <p className="text-xs text-slate-500">Connect with peers to learn together</p>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="relative z-10 bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <p className="text-xs text-yellow-800">{error}</p>
        </div>
      )}

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 overflow-auto">
        <div className="w-full max-w-2xl">
          {status === 'idle' && (
            <ConceptSelector
              concepts={concepts}
              selectedConcepts={selectedConcepts}
              onSelectionChange={setSelectedConcepts}
              onFindPartner={handleFindPartner}
              loading={loading}
            />
          )}

          {status === 'waiting' && (
            <WaitingCard
              conceptLabels={Array.from(selectedConcepts).map(id =>
                concepts.find(c => c.id === id)?.label || ""
              ).filter(Boolean)}
              onCancel={handleCancel}
            />
          )}

          {status === 'matched' && matchDetails && (
            <MatchedCard matchDetails={matchDetails} />
          )}
        </div>
      </main>
    </div>
  );
}
