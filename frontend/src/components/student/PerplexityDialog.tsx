"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Send, Loader2, ExternalLink } from "lucide-react";
import { nextApi } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface PerplexityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conceptLabel: string;
  conceptDescription?: string;
  lectureContext?: string;
}

// Component to render text with timestamps as styled badges
function TextWithTimestamps({ children }: { children: React.ReactNode }) {
  if (typeof children !== "string") return <>{children}</>;

  const text = children as string;
  // Match patterns like [10:00], [0:31], [12:45]
  const parts = text.split(/(\[\d{1,2}:\d{2}\])/g);

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/\[(\d{1,2}):(\d{2})\]/);
        if (match) {
          const [, minutes, seconds] = match;
          return (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-mono font-medium cursor-default hover:bg-blue-200 transition-colors"
              title={`Lecture timestamp: ${minutes}:${seconds}`}
            >
              {minutes}:{seconds}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
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
            key="perplexity-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />

          {/* Dialog */}
          <motion.div
            key="perplexity-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 via-blue-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                      <Sparkles className="text-teal-600" size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">Ask Perplexity AI</h2>
                      <p className="text-xs text-gray-500">
                        About: <span className="text-teal-600 font-medium">{conceptLabel}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        What would you like to know?
                      </label>
                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`e.g., "Can you explain ${conceptLabel} with a simple example?" or "Why is this concept important?"`}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all resize-none"
                        rows={4}
                        autoFocus
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono text-[10px]">Enter</kbd> to ask, or <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono text-[10px]">Shift+Enter</kbd> for new line
                      </p>
                    </div>

                    <button
                      onClick={handleAsk}
                      disabled={!question.trim() || isLoading}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-teal-600 disabled:hover:to-blue-600 shadow-lg shadow-teal-500/20"
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
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Your Question</p>
                      <p className="text-gray-800 leading-relaxed">{question}</p>
                    </div>

                    {/* AI Response */}
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="animate-spin text-teal-600" size={32} />
                          <p className="text-sm text-gray-500">Getting an answer for you...</p>
                        </div>
                      </div>
                    ) : response ? (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-br from-teal-50 via-blue-50/50 to-transparent border border-teal-200 rounded-xl p-5">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                              <Sparkles className="text-teal-600" size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-teal-700 uppercase tracking-wider mb-3">AI Response</p>
                              <div className="prose prose-sm prose-gray max-w-none markdown-content">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm, remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={{
                                    h1: ({ children }) => (
                                      <h1 className="text-lg font-semibold text-gray-800 mb-3 mt-4 first:mt-0">{children}</h1>
                                    ),
                                    h2: ({ children }) => (
                                      <h2 className="text-base font-semibold text-gray-800 mb-2 mt-3 first:mt-0">{children}</h2>
                                    ),
                                    h3: ({ children }) => (
                                      <h3 className="text-sm font-semibold text-gray-700 mb-2 mt-2 first:mt-0">{children}</h3>
                                    ),
                                    p: ({ children }) => (
                                      <p className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0">
                                        <TextWithTimestamps>{children}</TextWithTimestamps>
                                      </p>
                                    ),
                                    ul: ({ children }) => (
                                      <ul className="text-sm text-gray-700 space-y-1 mb-3 ml-4 list-disc">{children}</ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol className="text-sm text-gray-700 space-y-1 mb-3 ml-4 list-decimal">{children}</ol>
                                    ),
                                    li: ({ children }) => (
                                      <li className="text-sm text-gray-700 leading-relaxed">
                                        <TextWithTimestamps>{children}</TextWithTimestamps>
                                      </li>
                                    ),
                                    strong: ({ children }) => (
                                      <strong className="font-semibold text-gray-800">{children}</strong>
                                    ),
                                    em: ({ children }) => (
                                      <em className="italic text-gray-700">{children}</em>
                                    ),
                                    code: ({ children }) => (
                                      <code className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-teal-700">
                                        {children}
                                      </code>
                                    ),
                                    pre: ({ children }) => (
                                      <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto mb-3">
                                        {children}
                                      </pre>
                                    ),
                                    blockquote: ({ children }) => (
                                      <blockquote className="border-l-3 border-teal-300 pl-4 italic text-gray-600 my-3">
                                        {children}
                                      </blockquote>
                                    ),
                                    a: ({ href, children }) => (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-teal-600 hover:text-teal-700 underline"
                                      >
                                        {children}
                                      </a>
                                    ),
                                  }}
                                >
                                  {response}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>

                          {citations && citations.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-teal-200">
                              <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Sources</p>
                              <div className="flex flex-wrap gap-2">
                                {citations.map((citation, i) => (
                                  <a
                                    key={i}
                                    href={citation}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded text-xs text-gray-600 hover:text-teal-600 transition-colors"
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
                          className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-800 border border-gray-300 hover:border-gray-400 font-medium text-sm flex items-center justify-center gap-2 transition-all"
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
                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500 text-center">
                    💡 Tip: Be specific! Ask about examples, intuition, or how this concept relates to others.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Custom styles for KaTeX math rendering */}
      <style jsx global>{`
        .markdown-content .katex {
          font-size: 1.05em;
        }
        .markdown-content .katex-display {
          margin: 1rem 0;
          padding: 0.75rem;
          background: linear-gradient(to bottom right, rgb(249 250 251), rgb(243 244 246));
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          overflow-x: auto;
        }
        .markdown-content .katex-display > .katex {
          margin: 0;
        }
        .markdown-content .katex-html {
          color: rgb(55 65 81);
        }
        .markdown-content .katex .mord.text {
          color: rgb(55 65 81);
        }
        .markdown-content p .katex {
          padding: 0 0.125rem;
        }
        .markdown-content .katex .vlist-t {
          color: rgb(55 65 81);
        }
        .markdown-content .katex .mop,
        .markdown-content .katex .mbin,
        .markdown-content .katex .mrel {
          color: rgb(13 148 136);
        }
        .markdown-content .katex .mopen,
        .markdown-content .katex .mclose {
          color: rgb(107 114 128);
        }
      `}</style>
    </AnimatePresence>
  );
}