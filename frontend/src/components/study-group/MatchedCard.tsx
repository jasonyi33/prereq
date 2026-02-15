"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { User, Send, Loader2, MessageCircle, Video, VideoOff } from "lucide-react";
import { nextApi } from "@/lib/api";
import ZoomVideoCallWrapper from "./ZoomVideoCallWrapper";

interface MatchDetails {
  matchId: string;
  partner: { id: string; name: string; email?: string };
  conceptLabels: string[];
  zoomLink: string;
  complementarityScore: number;
}

interface PartnerProfile {
  year: string;
  bio: string;
  strengths: string[];
  weaknesses: string[];
}

interface Props {
  matchDetails: MatchDetails;
  partnerProfile?: PartnerProfile;
  studentName?: string;
}

interface Message {
  role: "user" | "partner";
  content: string;
  timestamp: Date;
}

export default function MatchedCard({ matchDetails, partnerProfile, studentName }: Props) {
  const { partner, conceptLabels } = matchDetails;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      const response = await nextApi.post("/api/study-groups/chat", {
        message: input.trim(),
        partnerName: partner.name,
        concepts: conceptLabels,
        conversationHistory: messages.map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content
        }))
      });

      const partnerMessage: Message = {
        role: "partner",
        content: response.reply,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, partnerMessage]);
    } catch (err) {
      console.error("Chat failed:", err);
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
    <div className="bg-white/70 backdrop-blur-2xl border border-gray-200/80 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] rounded-2xl p-8">
      {/* Avatar + name */}
      <div className="flex justify-center mb-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-gray-800 text-center mb-1">
        Matched with {partner.name}
      </h2>
      <p className="text-sm text-gray-400 text-center mb-6">
        You can help each other learn
      </p>

      {/* Partner profile info */}
      {partnerProfile && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-gray-100 text-gray-500 rounded-full">
              {partnerProfile.year}
            </span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{partnerProfile.bio}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Strong in</p>
              <div className="space-y-1">
                {partnerProfile.strengths.map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs text-gray-600">{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Needs help with</p>
              <div className="space-y-1">
                {partnerProfile.weaknesses.map(w => (
                  <div key={w} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-xs text-gray-600">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Focus areas */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
          Focus areas
        </p>
        <div className="flex flex-wrap gap-2">
          {conceptLabels.map(label => (
            <span
              key={label}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Chat interface */}
      {showChat && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Chat with {partner.name}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="h-64 bg-gray-50 rounded-xl border border-gray-200/80 overflow-y-auto mb-3 p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-sm text-gray-400">
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
                          ? "bg-gray-800 text-white"
                          : "bg-white border border-gray-200 text-gray-800"
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
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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

      {/* Video call section */}
      {showVideo ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Video Call
              </span>
            </div>
            <button
              onClick={() => setShowVideo(false)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <VideoOff className="w-3.5 h-3.5" />
              End Call
            </button>
          </div>
          <ZoomVideoCallWrapper
            topic={matchDetails.matchId}
            userName={studentName || "Student"}
            onLeave={() => setShowVideo(false)}
          />
        </div>
      ) : (
        <Button
          onClick={() => setShowVideo(true)}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 flex items-center justify-center gap-2"
        >
          <Video className="w-5 h-5" />
          Start Video Call
        </Button>
      )}
    </div>
  );
}
