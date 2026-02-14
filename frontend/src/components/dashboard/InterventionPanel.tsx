"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    if (!lectureId) return;
    setLoading(true);
    // TODO: POST /api/lectures/:id/interventions with { conceptIds }
    console.log("Get suggestions for:", strugglingConceptIds);
    // Mock response
    setSuggestions([
      {
        conceptId: "mock-1",
        conceptLabel: "Backpropagation",
        suggestion: "Consider walking through a concrete example with a 2-layer network. Many students are confusing the chain rule application with the overall gradient flow.",
      },
      {
        conceptId: "mock-2",
        conceptLabel: "Gradient Descent",
        suggestion: "Try a visual demonstration of learning rate effects. Students may benefit from seeing divergence with a high learning rate.",
      },
    ]);
    setLoading(false);
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
