"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { nextApi } from "@/lib/api";

interface Suggestion {
  conceptId: string;
  conceptLabel: string;
  suggestion: string;
}

interface InterventionPanelProps {
  lectureId: string | null;
  strugglingConceptIds: string[];
}

export default function InterventionPanel({
  lectureId,
  strugglingConceptIds,
}: InterventionPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleGetSuggestions() {
    if (!lectureId || strugglingConceptIds.length === 0) return;
    setLoading(true);
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/interventions`, {
        conceptIds: strugglingConceptIds,
      });
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("Failed to get suggestions:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Teaching Suggestions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          size="sm"
          onClick={handleGetSuggestions}
          disabled={loading || !lectureId || strugglingConceptIds.length === 0}
        >
          {loading ? "Loading..." : "Get Suggestions"}
        </Button>

        {suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.conceptId} className="space-y-1">
                <p className="text-sm font-medium">{s.conceptLabel}</p>
                <p className="text-sm text-muted-foreground">{s.suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
