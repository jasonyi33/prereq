"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { flaskApi } from "@/lib/api";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { useAuth } from "@/lib/auth-context";
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

interface ConceptComparison {
  conceptId: string;
  label: string;
  myConfidence: number;
  partnerConfidence: number;
  myColor: string;
  partnerColor: string;
}

interface MatchDetails {
  matchId: string;
  partner: { id: string; name: string; email?: string };
  conceptLabels: string[];
  myConceptLabels?: string[];
  partnerConceptLabels?: string[];
  conceptComparison?: ConceptComparison[];
  zoomLink: string;
  complementarityScore: number;
}

const STUDENT_PROFILES: Record<string, { year: string; bio: string; strengths: string[]; weaknesses: string[]; availability: string[] }> = {
  "Alex":    { year: "Senior",    bio: "Strong in linear algebra and optimization. Enjoys breaking down proofs.", strengths: ["Linear Algebra", "Calculus", "Gradient Descent"], weaknesses: ["Regularization", "Dropout"], availability: ["Mon 2-4pm", "Wed 10am-12pm", "Fri 3-5pm"] },
  "Jordan":  { year: "Junior",    bio: "Solid fundamentals, working through neural network concepts.", strengths: ["Vectors", "Matrices", "Loss Functions"], weaknesses: ["Backpropagation", "Regularization", "Bias-Variance Tradeoff"], availability: ["Mon 2-4pm", "Tue 1-3pm", "Thu 10am-12pm"] },
  "Sam":     { year: "Junior",    bio: "Getting comfortable with ML basics. Learns best through examples.", strengths: ["Vectors", "Matrices", "Derivatives"], weaknesses: ["Neural Networks", "Backpropagation", "Activation Functions"], availability: ["Wed 10am-12pm", "Thu 2-4pm", "Fri 3-5pm"] },
  "Taylor":  { year: "Sophomore", bio: "Math whiz, diving into the ML side of things.", strengths: ["Eigenvalues", "Chain Rule", "Bayes' Theorem"], weaknesses: ["Perceptron", "Forward Pass", "Layers"], availability: ["Tue 1-3pm", "Wed 10am-12pm", "Sat 10am-12pm"] },
};

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
  myConceptLabels: ["Backpropagation", "Dropout", "SGD"],
  partnerConceptLabels: ["Backpropagation", "Regularization", "Gradient Descent"],
  conceptComparison: [
    { conceptId: "c1", label: "Backpropagation", myConfidence: 0.1, partnerConfidence: 0.75, myColor: "red", partnerColor: "green" },
    { conceptId: "c2", label: "Dropout", myConfidence: 0.15, partnerConfidence: 0.5, myColor: "red", partnerColor: "yellow" },
    { conceptId: "c3", label: "SGD", myConfidence: 0.2, partnerConfidence: 0.85, myColor: "red", partnerColor: "green" },
    { conceptId: "c4", label: "Regularization", myConfidence: 0.7, partnerConfidence: 0.2, myColor: "green", partnerColor: "red" },
    { conceptId: "c5", label: "Gradient Descent", myConfidence: 0.8, partnerConfidence: 0.3, myColor: "green", partnerColor: "red" },
  ],
  zoomLink: "https://us06web.zoom.us/j/3285887393?pwd=eht46wK2kfhskTMDizbmMHsx1ldLok.1",
  complementarityScore: 0.68
};

export default function StudyGroupPage() {
  const params = useParams();
  const router = useRouter();
  const socket = useSocket();
  const { profile } = useAuth();
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

    // Auto-clear any existing matches/waiting status when entering this page
    flaskApi.post(`/api/courses/${courseId}/study-groups/opt-out`, { studentId })
      .catch(() => {}) // Ignore errors if not in pool
      .finally(() => {
        // Then fetch graph data
        flaskApi.get(`/api/courses/${courseId}/graph?student_id=${studentId}`)
          .then((graphData) => {
            // Extract concepts from graph
            const conceptOptions: ConceptOption[] = graphData.nodes.map((n: any) => ({
              id: n.id,
              label: n.label,
              category: n.category || "Other",
              confidence: n.confidence ?? 0,
              color: n.color || "gray"
            }));
            setConcepts(conceptOptions);
          })
          .catch(err => {
            console.error("Failed to load:", err);
            setError("Failed to load data. Using mock data for demo.");
            setConcepts(MOCK_CONCEPTS);
          })
          .finally(() => setLoading(false));
      });
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

  const partnerProfile = matchDetails ? STUDENT_PROFILES[matchDetails.partner.name] : undefined;
  const studentName = profile?.name || "Student";
  const myProfile = STUDENT_PROFILES[studentName] ?? {
    year: "Student",
    bio: "",
    strengths: [],
    weaknesses: [],
    availability: ["Mon 2-4pm", "Thu 2-4pm", "Sat 10am-12pm"],
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center animate-pulse">
            <Users className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#fafafa] text-gray-800 relative overflow-hidden font-sans">
      {/* Header */}
      <header className="relative z-10 h-14 shrink-0 flex items-center justify-between px-6 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-xl text-gray-800 tracking-tight">
            prereq
          </h1>
          <span className="text-xs text-gray-400 ml-1">Study Groups</span>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="relative z-10 bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <p className="text-xs text-yellow-800">{error}</p>
        </div>
      )}

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-start justify-center p-6 pt-8 overflow-auto">
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
            <MatchedCard
              matchDetails={matchDetails}
              partnerProfile={partnerProfile}
              studentName={studentName}
              myAvailability={myProfile?.availability}
            />
          )}
        </div>
      </main>
    </div>
  );
}
