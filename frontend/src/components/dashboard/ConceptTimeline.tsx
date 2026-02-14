"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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
      className="flex items-center gap-2 overflow-x-auto py-2 px-1"
    >
      {concepts.length === 0 && (
        <span className="text-xs text-muted-foreground">No concepts detected yet</span>
      )}
      {concepts.map((c, i) => (
        <Badge
          key={`${c.id}-${i}`}
          variant="outline"
          className="shrink-0 text-xs"
          style={{ borderColor: COLOR_HEX[c.color || "gray"] }}
        >
          {c.label}
        </Badge>
      ))}
    </div>
  );
}
