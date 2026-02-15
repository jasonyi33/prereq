"use client";

import { motion } from "motion/react";
import { CheckCircle2, AlertCircle, GraduationCap, Sparkles } from "lucide-react";
import { confidenceToNodeBorder } from "@/lib/colors";

interface WeakConcept {
  id: string;
  label: string;
  confidence: number;
}

interface LectureSummaryPanelProps {
  bullets: string[];
  titleSummary: string;
  weakConcepts: WeakConcept[];
  onStartTutoring: () => void;
  onConceptClick?: (conceptId: string) => void;
  loading?: boolean;
}

export default function LectureSummaryPanel({
  bullets,
  titleSummary,
  weakConcepts,
  onStartTutoring,
  onConceptClick,
  loading,
}: LectureSummaryPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5 text-gray-400 animate-pulse" />
        </div>
        <p className="text-base font-medium text-gray-600">Generating your lecture summary...</p>
        <p className="text-sm text-gray-400 mt-1">This usually takes a few seconds</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Title */}
      <div>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">
          Lecture Complete
        </span>
        <h2 className="text-lg font-semibold text-gray-800">{titleSummary}</h2>
      </div>

      {/* Bullet points */}
      <div>
        <h4 className="text-[10px] font-medium text-gray-700 uppercase tracking-wider mb-2">
          What Was Covered
        </h4>
        <div className="space-y-2">
          {bullets.map((bullet, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
              <CheckCircle2 className="text-green-400 shrink-0 mt-0.5" size={14} />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weak topics */}
      {weakConcepts.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-gray-700 uppercase tracking-wider mb-2">
            Topics to Review
          </h4>
          <div className="space-y-1.5">
            {weakConcepts.map((concept) => {
              const borderColor = confidenceToNodeBorder(concept.confidence);
              const pct = Math.round(concept.confidence * 100);
              return (
                <button
                  key={concept.id}
                  onClick={() => onConceptClick?.(concept.id)}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200 w-full text-left hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <AlertCircle size={14} style={{ color: borderColor }} className="shrink-0" />
                  <span className="text-sm text-gray-700 flex-1">{concept.label}</span>
                  <span className="text-xs font-mono" style={{ color: borderColor }}>
                    {pct}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Encouragement */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <p className="text-sm text-gray-500 leading-relaxed">
          {weakConcepts.length === 0
            ? "Great work today! You have a solid grasp of the material covered."
            : `Nice job attending! Focus on the ${weakConcepts.length} topic${weakConcepts.length > 1 ? "s" : ""} above to solidify your understanding.`}
        </p>
      </div>

      {/* CTA */}
      {weakConcepts.length > 0 && (
        <button
          onClick={onStartTutoring}
          className="w-full py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
        >
          <GraduationCap size={16} />
          <span>Start Tutoring</span>
        </button>
      )}
    </motion.div>
  );
}
