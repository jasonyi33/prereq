"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Send, Loader2, ExternalLink } from "lucide-react";
import { nextApi } from "@/lib/api";

interface PerplexityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conceptLabel: string;
  conceptDescription?: string;
  lectureContext?: string; // Optional transcript excerpts
}

export default function PerplexityDialog({
  isOpen,
  onClose,
  conceptLabel,
  conceptDescription,
  lectureContext,
}: PerplexityDialogProps) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);

  const handleAsk = async () => {
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    setHasAsked(true);

    try {
      const res = await nextApi.post("/api/perplexity/ask", {
        question: question.trim(),
        conceptLabel,
        conceptDescription,
        lectureContext,
      });

      setResponse(res.response);
      setCitations(res.citations || []);
    } catch (err) {
      console.error("Perplexity query failed:", err);
      setResponse(
        "I'm having trouble connecting right now. Please try again in a moment or check out the recommended resources."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setQuestion("");
    setResponse(null);
    setCitations([]);
    setHasAsked(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-teal-500/10 via-blue-500/10 to-purple-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                      <Sparkles className="text-teal-400" size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Ask Perplexity AI</h2>
                      <p className="text-xs text-slate-400">
                        About: <span className="text-teal-400 font-medium">{conceptLabel}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {/* Question Input */}
                {!hasAsked && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        What would you like to know?
                      </label>
                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`e.g., "Can you explain ${conceptLabel} with a simple example?" or "Why is this concept important?"`}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all resize-none"
                        rows={4}
                        autoFocus
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-400">Enter</kbd> to ask, or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-slate-400">Shift+Enter</kbd> for new line
                      </p>
                    </div>

                    <button
                      onClick={handleAsk}
                      disabled={!question.trim() || isLoading}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-teal-600 disabled:hover:to-blue-600"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          <span>Thinking...</span>
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          <span>Ask AI</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Response */}
                {hasAsked && (
                  <div className="space-y-6">
                    {/* Student's question */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <p className="text-sm font-medium text-slate-400 mb-2">Your Question:</p>
                      <p className="text-white">{question}</p>
                    </div>

                    {/* AI Response */}
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="animate-spin text-teal-400" size={32} />
                          <p className="text-sm text-slate-400">Getting an answer for you...</p>
                        </div>
                      </div>
                    ) : response ? (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-br from-teal-500/10 via-blue-500/5 to-transparent border border-teal-500/20 rounded-xl p-5">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="text-teal-400" size={16} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-teal-400 mb-1">AI Response</p>
                              <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                                {response}
                              </div>
                            </div>
                          </div>

                          {citations && citations.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-teal-500/10">
                              <p className="text-xs font-medium text-slate-400 mb-2">Sources:</p>
                              <div className="flex flex-wrap gap-2">
                                {citations.map((citation, i) => (
                                  <a
                                    key={i}
                                    href={citation}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/50 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-400 hover:text-teal-400 transition-colors"
                                  >
                                    <ExternalLink size={12} />
                                    <span>Source {i + 1}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Ask another question */}
                        <button
                          onClick={() => {
                            setQuestion("");
                            setResponse(null);
                            setCitations([]);
                            setHasAsked(false);
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 font-medium text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          <Sparkles size={16} />
                          <span>Ask Another Question</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              {!hasAsked && (
                <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/30">
                  <p className="text-xs text-slate-500 text-center">
                    💡 Tip: Be specific! Ask about examples, intuition, or how this concept relates to others.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}