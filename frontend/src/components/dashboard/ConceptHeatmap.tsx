"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLOR_HEX } from "@/lib/colors";

export interface HeatmapConcept {
  id: string;
  label: string;
  distribution: { green: number; yellow: number; red: number; gray: number };
  avg_confidence: number;
}

interface ConceptHeatmapProps {
  concepts: HeatmapConcept[];
  totalStudents: number;
}

export default function ConceptHeatmap({ concepts, totalStudents }: ConceptHeatmapProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Class Mastery Heatmap</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-1.5">
        {concepts.length === 0 && (
          <p className="text-sm text-muted-foreground">No concept data yet</p>
        )}
        {concepts.map((c) => {
          const total = totalStudents || 1;
          return (
            <div key={c.id} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs truncate max-w-[140px]">{c.label}</span>
                <span className="text-xs text-muted-foreground">
                  {(c.avg_confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-sm">
                {(["green", "yellow", "red", "gray"] as const).map((color) => {
                  const pct = (c.distribution[color] / total) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={color}
                      style={{ width: `${pct}%`, backgroundColor: COLOR_HEX[color] }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
