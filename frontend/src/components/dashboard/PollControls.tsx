"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLOR_HEX } from "@/lib/colors";

interface PollState {
  pollId: string | null;
  question: string | null;
  conceptLabel: string | null;
  status: "idle" | "preview" | "active" | "closed";
  results: { green: number; yellow: number; red: number } | null;
  totalResponses: number;
}

interface PollControlsProps {
  lectureId: string | null;
}

export default function PollControls({ lectureId }: PollControlsProps) {
  const [poll, setPoll] = useState<PollState>({
    pollId: null,
    question: null,
    conceptLabel: null,
    status: "idle",
    results: null,
    totalResponses: 0,
  });

  async function handleGenerate() {
    // TODO: POST /api/lectures/:id/poll/generate
    console.log("Generate poll for lecture:", lectureId);
    setPoll({
      pollId: "mock-poll-1",
      question: "What is the gradient of f(x) = x^2 at x = 3?",
      conceptLabel: "Gradients",
      status: "preview",
      results: null,
      totalResponses: 0,
    });
  }

  async function handleActivate() {
    // TODO: POST /api/lectures/:id/poll/:pollId/activate
    console.log("Activate poll:", poll.pollId);
    setPoll((p) => ({ ...p, status: "active" }));
  }

  async function handleClose() {
    // TODO: POST /api/lectures/:id/poll/:pollId/close
    console.log("Close poll:", poll.pollId);
    setPoll((p) => ({
      ...p,
      status: "closed",
      results: { green: 12, yellow: 8, red: 5 },
      totalResponses: 25,
    }));
  }

  function handleReset() {
    setPoll({
      pollId: null,
      question: null,
      conceptLabel: null,
      status: "idle",
      results: null,
      totalResponses: 0,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Poll Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {poll.status === "idle" && (
          <Button size="sm" onClick={handleGenerate} disabled={!lectureId}>
            Generate Question
          </Button>
        )}

        {poll.status === "preview" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{poll.conceptLabel}</p>
            <p className="text-sm">{poll.question}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleActivate}>Send to Students</Button>
              <Button size="sm" variant="outline" onClick={handleReset}>Discard</Button>
            </div>
          </div>
        )}

        {poll.status === "active" && (
          <div className="space-y-2">
            <p className="text-sm">{poll.question}</p>
            <p className="text-xs text-muted-foreground">
              Responses: {poll.totalResponses}
            </p>
            <Button size="sm" variant="destructive" onClick={handleClose}>
              Close Poll
            </Button>
          </div>
        )}

        {poll.status === "closed" && poll.results && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Results ({poll.totalResponses} responses)</p>
            <div className="flex h-4 w-full overflow-hidden rounded-sm">
              {(["green", "yellow", "red"] as const).map((color) => {
                const pct = (poll.results![color] / poll.totalResponses) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={color}
                    style={{ width: `${pct}%`, backgroundColor: COLOR_HEX[color] }}
                  />
                );
              })}
            </div>
            <Button size="sm" variant="outline" onClick={handleReset}>
              New Question
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
