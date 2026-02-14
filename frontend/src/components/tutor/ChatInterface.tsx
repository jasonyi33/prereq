"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, User, MessageCircle, Lightbulb } from "lucide-react";
import { nextApi } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

interface MasteryUpdate {
  conceptId: string;
  conceptLabel?: string;
  oldColor: string;
  newColor: string;
  confidence: number;
}

interface ChatInterfaceProps {
  sessionId: string;
  initialMessages: ChatMessage[];
  onMasteryUpdate?: (updates: MasteryUpdate[]) => void;
}

const SUGGESTED_PROMPTS = [
  "Explain this concept in simpler terms",
  "Can you give me an example?",
  "How does this connect to other topics?",
  "Why is this important?",
];

function MessageBubble({ role, content, timestamp, isLatest }: { role: string; content: string; timestamp?: string; isLatest?: boolean }) {
  const isUser = role === "user";

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 group ${isLatest ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-300" : ""}`}>
      {/* Tutor avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shrink-0 mr-2.5 mt-5">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[75%]`}>
        <span className="text-xs text-slate-400 mb-1 px-1">
          {isUser ? "You" : "Tutor"}
        </span>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-slate-800 text-white rounded-tr-sm"
              : "bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm text-slate-700 rounded-tl-sm"
          }`}
        >
          {content}
        </div>
        {timestamp && (
          <span className="text-xs text-slate-400 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(timestamp)}
          </span>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 ml-2.5 mt-5">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shrink-0 mr-2.5 mt-5">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col items-start">
        <span className="text-xs text-slate-400 mb-1 px-1">Tutor</span>
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="flex space-x-1.5">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestedPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3 mb-2">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white/80 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150"
        >
          <Lightbulb className="w-3 h-3" />
          {prompt}
        </button>
      ))}
    </div>
  );
}

export default function ChatInterface({
  sessionId,
  initialMessages,
  onMasteryUpdate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  useEffect(() => {
    if (!loading) textareaRef.current?.focus();
  }, [loading]);

  function resetTextareaHeight() {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  async function handleSend(content?: string) {
    const text = (content || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setShowSuggestions(false);
    resetTextareaHeight();
    setLoading(true);

    try {
      const res = await nextApi.post(`/api/tutoring/sessions/${sessionId}/messages`, {
        content: text,
      });
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.message?.content || "I'm not sure how to respond to that.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.masteryUpdates && res.masteryUpdates.length > 0 && onMasteryUpdate) {
        onMasteryUpdate(res.masteryUpdates);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestedPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200 shadow-sm overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Ready to learn!</h3>
              <p className="text-sm text-slate-500">
                Your tutor will help you strengthen concepts you&apos;re struggling with.
                Ask questions and explain your thinking.
              </p>
              <SuggestedPrompts onSelect={handleSuggestedPrompt} />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                isLatest={i === messages.length - 1}
              />
            ))}
            {loading && <TypingIndicator />}
            {showSuggestions && messages.length <= 1 && !loading && (
              <SuggestedPrompts onSelect={handleSuggestedPrompt} />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 pt-2">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="max-w-3xl mx-auto"
        >
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-150">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              disabled={loading}
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3 pr-14 text-sm placeholder:text-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto leading-relaxed"
              style={{ minHeight: "44px", maxHeight: "160px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all duration-150"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
