"use client";

import { useEffect, useRef } from "react";
import { COLOR_HEX } from "@/lib/colors";

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp?: number;
  speakerName?: string;
  detectedConcepts?: { id: string; label: string; color?: string }[];
}

interface TranscriptFeedProps {
  chunks: TranscriptChunk[];
}

export default function TranscriptFeed({ chunks }: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks.length]);

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
            Live Transcript
          </h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        {chunks.length === 0 && (
          <p className="text-sm text-slate-400">Waiting for transcript...</p>
        )}
        {chunks.map((chunk) => (
          <div key={chunk.id} className="text-sm leading-relaxed">
            {chunk.speakerName && (
              <span className="font-medium text-slate-400 text-xs uppercase tracking-wide">
                {chunk.speakerName}:{" "}
              </span>
            )}
            <span className="text-slate-600">{chunk.text}</span>
            {chunk.detectedConcepts && chunk.detectedConcepts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {chunk.detectedConcepts.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border"
                    style={{
                      borderColor: (COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray) + "40",
                      color: COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray,
                      backgroundColor: (COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray) + "10",
                    }}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
