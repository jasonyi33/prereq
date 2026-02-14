"use client";

import { useState } from "react";
import { nextApi } from "@/lib/api";

interface PollCardProps {
  pollId: string;
  question: string;
  conceptLabel: string;
  studentId: string;
}

export default function PollCard({ pollId, question, conceptLabel, studentId }: PollCardProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const res = await nextApi.post(`/api/polls/${pollId}/respond`, {
        studentId,
        answer: answer.trim(),
      });
      setFeedback(res.evaluation?.feedback || "Answer submitted.");
      setSubmitted(true);
    } catch {
      setFeedback("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Gradient top strip */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />

      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-800">Poll Question</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 rounded-full">
            {conceptLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 space-y-3">
        <p className="text-sm text-slate-700 leading-relaxed">{question}</p>

        <textarea
          placeholder="Type your answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-400"
        />

        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={loading || !answer.trim()}
            className="group relative overflow-hidden w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-md"
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="relative">{loading ? "Submitting..." : "Submit"}</span>
          </button>
        )}

        {feedback && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm text-slate-600 italic">{feedback}</p>
          </div>
        )}
      </div>
    </div>
  );
}
