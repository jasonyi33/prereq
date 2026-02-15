"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { User, Send, Loader2, MessageCircle, ExternalLink, ArrowRight, ArrowLeft, Clock } from "lucide-react";
import { nextApi } from "@/lib/api";
import { COLOR_HEX } from "@/lib/colors";

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

interface PartnerProfile {
  year: string;
  bio: string;
  strengths: string[];
  weaknesses: string[];
  availability?: string[];
}

interface Props {
  matchDetails: MatchDetails;
  partnerProfile?: PartnerProfile;
  studentName?: string;
  myAvailability?: string[];
}

interface Message {
  role: "user" | "partner";
  content: string;
  timestamp: Date;
}

function ConfidenceBar({ confidence, color, side }: { confidence: number; color: string; side: "left" | "right" }) {
  const hex = COLOR_HEX[color] || COLOR_HEX.gray;
  const pct = Math.round(confidence * 100);
  return (
    <div className={`flex items-center gap-1.5 ${side === "left" ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${side === "left" ? "ml-auto" : ""}`}
          style={{ width: `${pct}%`, backgroundColor: hex }}
        />
      </div>
      <span className="text-[10px] text-gray-400 w-7 tabular-nums" style={{ textAlign: side === "left" ? "left" : "right" }}>
        {pct}%
      </span>
    </div>
  );
}

export default function MatchedCard({ matchDetails, partnerProfile, studentName, myAvailability }: Props) {
  const { partner, conceptLabels, myConceptLabels, partnerConceptLabels, conceptComparison } = matchDetails;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(true);
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

  // Compute complementarity percentage from comparison data
  const complementarityPct = conceptComparison
    ? Math.round(
        (conceptComparison.reduce((sum, c) => sum + Math.abs(c.myConfidence - c.partnerConfidence), 0) /
          conceptComparison.length) * 100
      )
    : Math.round(matchDetails.complementarityScore * 100);

  // Compute availability overlap
  const partnerAvailability = partnerProfile?.availability || [];
  const overlappingSlots = myAvailability?.filter(s => partnerAvailability.includes(s)) || [];
  const myOnlySlots = myAvailability?.filter(s => !partnerAvailability.includes(s)) || [];
  const partnerOnlySlots = partnerAvailability.filter(s => !myAvailability?.includes(s));

  return (
    <div className="bg-white/70 backdrop-blur-2xl border border-gray-200/80 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] rounded-2xl p-8">
      {/* A. Partner header */}
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

      {partnerProfile && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-gray-100 text-gray-500 rounded-full">
              {partnerProfile.year}
            </span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{partnerProfile.bio}</p>
        </div>
      )}

      {/* B. Why you were matched — per-concept comparison */}
      {conceptComparison && conceptComparison.length > 0 ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Why you were matched
            </p>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {complementarityPct}% complementary
            </span>
          </div>

          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
              <span className="w-[110px] text-right pr-2">You</span>
              <span className="flex-1 text-center" />
              <span className="w-[110px] text-left pl-2">{partner.name}</span>
            </div>

            {conceptComparison.map((c) => {
              const theyTeachYou = c.partnerConfidence > c.myConfidence + 0.15;
              const youTeachThem = c.myConfidence > c.partnerConfidence + 0.15;
              return (
                <div key={c.conceptId} className="flex items-center gap-1">
                  {/* My bar (right-aligned) */}
                  <div className="w-[110px]">
                    <ConfidenceBar confidence={c.myConfidence} color={c.myColor} side="left" />
                  </div>

                  {/* Concept label + arrow indicator */}
                  <div className="flex-1 flex items-center justify-center gap-1 min-w-0">
                    {theyTeachYou && <ArrowLeft className="w-3 h-3 text-green-500 shrink-0" />}
                    <span className="text-xs text-gray-600 font-medium truncate text-center">{c.label}</span>
                    {youTeachThem && <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />}
                  </div>

                  {/* Partner bar (left-aligned) */}
                  <div className="w-[110px]">
                    <ConfidenceBar confidence={c.partnerConfidence} color={c.partnerColor} side="right" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><ArrowLeft className="w-2.5 h-2.5 text-green-500" /> They can help you</span>
            <span className="flex items-center gap-1"><ArrowRight className="w-2.5 h-2.5 text-blue-500" /> You can help them</span>
          </div>
        </div>
      ) : partnerProfile ? (
        /* Fallback: old-style strengths/weaknesses grid */
        <div className="mb-6">
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
      ) : null}

      {/* C. Study focus — split columns */}
      {myConceptLabels && partnerConceptLabels ? (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            Study focus
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                You want to work on
              </p>
              <div className="space-y-1">
                {myConceptLabels.map(label => (
                  <span
                    key={label}
                    className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg mr-1.5 mb-1"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                {partner.name} wants to work on
              </p>
              <div className="space-y-1">
                {partnerConceptLabels.map(label => (
                  <span
                    key={label}
                    className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg mr-1.5 mb-1"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Fallback: flat merged focus areas */
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
      )}

      {/* D. Available times */}
      {myAvailability && partnerProfile?.availability && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Available times
            </p>
          </div>

          {overlappingSlots.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider mb-1.5">Both free</p>
              <div className="flex flex-wrap gap-1.5">
                {overlappingSlots.map(slot => (
                  <span
                    key={slot}
                    className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg border border-green-200"
                  >
                    {slot}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(myOnlySlots.length > 0 || partnerOnlySlots.length > 0) && (
            <div className="flex gap-4 text-[10px] text-gray-400 mt-2">
              {myOnlySlots.length > 0 && (
                <div>
                  <span className="font-medium">Your other times:</span>{" "}
                  {myOnlySlots.join(", ")}
                </div>
              )}
              {partnerOnlySlots.length > 0 && (
                <div>
                  <span className="font-medium">{partner.name}&#39;s other times:</span>{" "}
                  {partnerOnlySlots.join(", ")}
                </div>
              )}
            </div>
          )}

          {overlappingSlots.length === 0 && (
            <p className="text-xs text-gray-400 italic">No overlapping times found. Try messaging to find a time that works.</p>
          )}
        </div>
      )}

      {/* E. Chat interface */}
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

      {/* Join Zoom call */}
      <Button
        onClick={() => window.open(matchDetails.zoomLink, '_blank', 'noopener,noreferrer')}
        className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 flex items-center justify-center gap-2"
      >
        <ExternalLink className="w-5 h-5" />
        Join Zoom Call
      </Button>
    </div>
  );
}
