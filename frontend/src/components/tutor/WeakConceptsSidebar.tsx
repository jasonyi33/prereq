"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLOR_HEX } from "@/lib/colors";

export interface WeakConcept {
  id: string;
  label: string;
  color: string;
  confidence: number;
}

interface WeakConceptsSidebarProps {
  concepts: WeakConcept[];
}

export default function WeakConceptsSidebar({ concepts }: WeakConceptsSidebarProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Weak Concepts</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {concepts.length === 0 && (
          <p className="text-sm text-muted-foreground">No weak concepts</p>
        )}
        {concepts.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: COLOR_HEX[c.color] || COLOR_HEX.gray }}
            />
            <span className="text-sm truncate">{c.label}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {(c.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
