"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, User, Send, Loader2, MessageCircle } from "lucide-react";
import { nextApi } from "@/lib/api";

interface MatchDetails {
  matchId: string;
  partner: { id: string; name: string; email?: string };
  conceptLabels: string[];
  zoomLink: string;
  complementarityScore: number;
}

interface Props {
  matchDetails: MatchDetails;
}

interface Message {
  role: "user" | "partner";
  content: string;
  timestamp: Date;
}

export default function MatchedCard({ matchDetails }: Props) {
  const { partner, conceptLabels, zoomLink, complementarityScore } = matchDetails;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const getMatchQuality = () => {
    if (complementarityScore >= 0.6) return { label: "Excellent", color: "text-emerald-600" };
    if (complementarityScore >= 0.4) return { label: "Good", color: "text-blue-600" };
    return { label: "Fair", color: "text-slate-600" };
  };

  const matchQuality = getMatchQuality();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      console.log("Sending chat message to:", "/api/study-groups/chat");
      const response = await nextApi.post("/api/study-groups/chat", {
        message: input.trim(),
        partnerName: partner.name,
        concepts: conceptLabels,
        conversationHistory: messages.map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content
        }))
      });

      console.log("Chat response:", response);

      const partnerMessage: Message = {
        role: "partner",
        content: response.reply,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, partnerMessage]);
    } catch (err) {
      console.error("Chat failed:", err);
      console.error("Error details:", err instanceof Error ? err.message : String(err));
      const errorMessage: Message = {
        role: "partner",
        content: "Sorry, I'm having trouble connecting. Can you try again?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="p-8 bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
      <div className="flex justify-center mb-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-slate-800 text-center mb-1">
        Matched with {partner.name}
      </h2>
      <p className="text-sm text-slate-500 text-center mb-6">
        {matchQuality.label} match • You can help each other learn
      </p>

      {/* Concepts */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2.5">
          Focus areas
        </p>
        <div className="flex flex-wrap gap-2">
          {conceptLabels.map(label => (
            <span
              key={label}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Match quality indicator */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Match quality
          </span>
          <span className={`text-sm font-semibold ${matchQuality.color}`}>
            {matchQuality.label}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${complementarityScore * 100}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          Based on your knowledge gaps and strengths, you can effectively tutor each other.
        </p>
      </div>

      {/* Chat interface */}
      {showChat && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Chat with {partner.name}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="h-64 bg-slate-50 rounded-lg border border-slate-200 overflow-y-auto mb-3 p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-sm text-slate-400">
                  Start chatting about {conceptLabels[0]}...
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-800"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or share an insight..."
              className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Zoom link */}
      <Button
        onClick={() => window.open(zoomLink, "_blank")}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.5 10.5v3l6-3v6l6-3v-3l-6 3v-6l-6 3z"/>
        </svg>
        Join Zoom
      </Button>
    </Card>
  );
}
