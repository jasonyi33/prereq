"use client";

import { useEffect, useRef } from "react";
import { COLOR_HEX } from "@/lib/colors";

export interface TimelineConcept {
  id: string;
  label: string;
  color?: string;
}

interface ConceptTimelineProps {
  concepts: TimelineConcept[];
}

export default function ConceptTimeline({ concepts }: ConceptTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [concepts.length]);

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-2 overflow-x-auto py-2.5 px-1"
    >
      {concepts.length === 0 && (
        <span className="text-xs text-slate-400">No concepts detected yet</span>
      )}
      {concepts.map((c, i) => (
        <span
          key={`${c.id}-${i}`}
          className="shrink-0 inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-medium border text-slate-600 transition-all duration-200 hover:bg-slate-50"
          style={{
            borderColor: (COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray) + "40",
            backgroundColor: (COLOR_HEX[c.color || "gray"] || COLOR_HEX.gray) + "08",
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
