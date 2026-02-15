"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, X, CheckCircle, XCircle, Loader2, Trophy, TrendingUp } from "lucide-react";
import { flaskApi } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface ConceptLearningProps {
  conceptId: string;
  conceptLabel: string;
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfidenceUpdate?: (oldColor: string, newColor: string, confidence: number) => void;
}

interface Question {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

type ViewMode = "learning" | "quiz" | "results";

export default function ConceptLearning({
  conceptId,
  conceptLabel,
  studentId,
  isOpen,
  onClose,
  onConfidenceUpdate
}: ConceptLearningProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("learning");
  const [learningContent, setLearningContent] = useState<string>("");
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [loadingLearning, setLoadingLearning] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number } | null>(null);
  const [confidenceBoost, setConfidenceBoost] = useState<number>(0);

  // Load learning content when opened
  useEffect(() => {
    if (isOpen && viewMode === "learning" && !learningContent) {
      loadLearningPage();
    }
  }, [isOpen, viewMode, conceptId]);

  // Load quiz when switching to quiz mode
  useEffect(() => {
    if (viewMode === "quiz" && quizQuestions.length === 0) {
      loadQuiz();
    }
  }, [viewMode, conceptId]);

  const loadLearningPage = async () => {
    setLoadingLearning(true);
    try {
      const data = await flaskApi.get(`/api/concepts/${conceptId}/learning-page`);
      setLearningContent(data.content || "");
    } catch (err) {
      console.error("Failed to load learning page:", err);
      setLearningContent("Failed to load learning content. Please try again.");
    } finally {
      setLoadingLearning(false);
    }
  };

  const loadQuiz = async () => {
    setLoadingQuiz(true);
    try {
      const data = await flaskApi.get(`/api/concepts/${conceptId}/quiz`);
      setQuizQuestions(data.questions || []);
      setCurrentQuestion(0);
      setSelectedAnswers([]);
      setShowExplanation(false);
    } catch (err) {
      console.error("Failed to load quiz:", err);
      setQuizQuestions([]);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (showExplanation) return; // Can't change answer after revealing

    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleCheckAnswer = () => {
    setShowExplanation(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowExplanation(false);
    } else {
      // Quiz finished - calculate score and submit
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const correctCount = selectedAnswers.filter(
      (answer, idx) => answer === quizQuestions[idx].correct_answer
    ).length;

    setQuizScore({ correct: correctCount, total: quizQuestions.length });

    // Submit to backend to update confidence
    try {
      const result = await flaskApi.post(`/api/concepts/${conceptId}/quiz-submit`, {
        studentId,
        answers: selectedAnswers,
        correctCount,
        totalQuestions: quizQuestions.length
      });

      setConfidenceBoost(result.confidence_boost);

      // Notify parent of confidence update
      if (onConfidenceUpdate && result.old_color !== result.new_color) {
        onConfidenceUpdate(result.old_color, result.new_color, result.new_confidence);
      }

      setViewMode("results");
    } catch (err) {
      console.error("Failed to submit quiz:", err);
      setViewMode("results"); // Show results anyway
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswers([]);
    setShowExplanation(false);
    setQuizScore(null);
    setViewMode("quiz");
    loadQuiz(); // Reload questions
  };

  const currentQ = quizQuestions[currentQuestion];
  const isAnswerCorrect = selectedAnswers[currentQuestion] === currentQ?.correct_answer;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="concept-learning-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
          />

          {/* Dialog */}
          <motion.div
            key="concept-learning-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <BookOpen className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">{conceptLabel}</h2>
                      <p className="text-xs text-slate-500">Interactive Learning</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tab selector */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setViewMode("learning")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewMode === "learning"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <BookOpen className="w-4 h-4 inline mr-1.5" />
                    Learning Page
                  </button>
                  <button
                    onClick={() => setViewMode("quiz")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewMode === "quiz" || viewMode === "results"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Trophy className="w-4 h-4 inline mr-1.5" />
                    Practice Quiz
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {viewMode === "learning" && (
                  <div>
                    {loadingLearning ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      </div>
                    ) : (
                      <div className="prose prose-slate max-w-none markdown-learning">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="text-2xl font-bold text-slate-800 mb-4 mt-6 first:mt-0">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-xl font-semibold text-slate-800 mb-3 mt-5 first:mt-0">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-lg font-semibold text-slate-700 mb-2 mt-4 first:mt-0">{children}</h3>
                            ),
                            p: ({ children }) => (
                              <p className="text-slate-700 leading-relaxed mb-4">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="text-slate-700 space-y-2 mb-4 ml-6 list-disc">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="text-slate-700 space-y-2 mb-4 ml-6 list-decimal">{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-slate-700 leading-relaxed">{children}</li>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-slate-900">{children}</strong>
                            ),
                            code: ({ children }) => (
                              <code className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-blue-600">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto mb-4">
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-blue-300 pl-4 italic text-slate-600 my-4 bg-blue-50 py-2 rounded-r">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {learningContent}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === "quiz" && (
                  <div>
                    {loadingQuiz ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      </div>
                    ) : quizQuestions.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        Failed to load quiz questions. Please try again.
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto">
                        {/* Progress */}
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600">
                              Question {currentQuestion + 1} of {quizQuestions.length}
                            </span>
                            <span className="text-xs text-slate-400">
                              {selectedAnswers.filter((a, i) => a === quizQuestions[i]?.correct_answer).length} correct
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Question */}
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold text-slate-800 mb-4">
                            {currentQ?.question}
                          </h3>

                          {/* Options */}
                          <div className="space-y-3">
                            {currentQ?.options.map((option, idx) => {
                              const isSelected = selectedAnswers[currentQuestion] === idx;
                              const isCorrect = idx === currentQ.correct_answer;
                              const showCorrectness = showExplanation;

                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleAnswerSelect(idx)}
                                  disabled={showExplanation}
                                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                                    showCorrectness && isCorrect
                                      ? "border-green-500 bg-green-50"
                                      : showCorrectness && isSelected && !isCorrect
                                        ? "border-red-500 bg-red-50"
                                        : isSelected
                                          ? "border-blue-500 bg-blue-50"
                                          : "border-slate-200 hover:border-slate-300 bg-white"
                                  } ${showExplanation ? "cursor-default" : "cursor-pointer"}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-700">{option}</span>
                                    {showCorrectness && isCorrect && (
                                      <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                                    )}
                                    {showCorrectness && isSelected && !isCorrect && (
                                      <XCircle className="text-red-600 flex-shrink-0" size={20} />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Explanation */}
                        {showExplanation && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-xl border mb-6 ${
                              isAnswerCorrect
                                ? "bg-green-50 border-green-200"
                                : "bg-orange-50 border-orange-200"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {isAnswerCorrect ? (
                                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                              ) : (
                                <XCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                              )}
                              <div>
                                <p className={`text-sm font-medium mb-1 ${
                                  isAnswerCorrect ? "text-green-800" : "text-orange-800"
                                }`}>
                                  {isAnswerCorrect ? "Correct!" : "Not quite"}
                                </p>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                  {currentQ.explanation}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                          {!showExplanation ? (
                            <button
                              onClick={handleCheckAnswer}
                              disabled={selectedAnswers[currentQuestion] === undefined}
                              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              Check Answer
                            </button>
                          ) : (
                            <button
                              onClick={handleNextQuestion}
                              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all"
                            >
                              {currentQuestion < quizQuestions.length - 1 ? "Next Question" : "Finish Quiz"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === "results" && quizScore && (
                  <div className="max-w-2xl mx-auto text-center py-8">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center mx-auto mb-6">
                      <Trophy className="w-10 h-10 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Quiz Complete!</h3>
                    <p className="text-slate-600 mb-6">
                      You scored {quizScore.correct} out of {quizScore.total} questions correctly
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
                      <div className="flex items-center justify-center gap-3 mb-3">
                        <TrendingUp className="text-blue-600" size={24} />
                        <span className="text-3xl font-bold text-slate-800">
                          {Math.round((quizScore.correct / quizScore.total) * 100)}%
                        </span>
                      </div>
                      {confidenceBoost > 0 && (
                        <p className="text-sm text-slate-600">
                          Confidence increased by <strong className="text-blue-600">+{Math.round(confidenceBoost * 100)}%</strong>
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={resetQuiz}
                        className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => setViewMode("learning")}
                        className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all"
                      >
                        Review Concept
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Custom styles for KaTeX math rendering */}
          <style jsx global>{`
            .markdown-learning .katex {
              font-size: 1.1em;
            }
            .markdown-learning .katex-display {
              margin: 1.5rem 0;
              padding: 1rem;
              background: linear-gradient(to bottom right, rgb(248 250 252), rgb(241 245 249));
              border: 1px solid rgb(226 232 240);
              border-radius: 0.75rem;
              overflow-x: auto;
            }
            .markdown-learning .katex-display > .katex {
              margin: 0;
            }
            .markdown-learning .katex-html {
              color: rgb(51 65 85);
            }
            .markdown-learning .katex .mord.text {
              color: rgb(51 65 85);
            }
            .markdown-learning p .katex {
              padding: 0 0.25rem;
            }
            .markdown-learning .katex .mop,
            .markdown-learning .katex .mbin,
            .markdown-learning .katex .mrel {
              color: rgb(37 99 235);
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
