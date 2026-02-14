"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Live Transcript</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {chunks.length === 0 && (
          <p className="text-sm text-muted-foreground">Waiting for transcript...</p>
        )}
        {chunks.map((chunk) => (
          <div key={chunk.id} className="text-sm">
            {chunk.speakerName && (
              <span className="font-medium text-muted-foreground">{chunk.speakerName}: </span>
            )}
            <span>{chunk.text}</span>
            {chunk.detectedConcepts && chunk.detectedConcepts.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {chunk.detectedConcepts.map((c) => (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className="text-xs"
                    style={{ borderColor: COLOR_HEX[c.color || "gray"] }}
                  >
                    {c.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  );
}
