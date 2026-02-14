"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nextApi } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
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

export default function ChatInterface({
  sessionId,
  initialMessages,
  onMasteryUpdate,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const content = input.trim();
    if (!content || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await nextApi.post(`/api/tutoring/sessions/${sessionId}/messages`, {
        content,
      });
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.message?.content || "I'm not sure how to respond to that.",
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
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3 flex gap-2">
        <Input
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
