"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLOR_HEX } from "@/lib/colors";
import { nextApi } from "@/lib/api";

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
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!lectureId) return;
    setGenerating(true);
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/poll/generate`, {});
      setPoll({
        pollId: data.pollId,
        question: data.question,
        conceptLabel: data.conceptLabel,
        status: "preview",
        results: null,
        totalResponses: 0,
      });
    } catch (err) {
      console.error("Failed to generate poll:", err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleActivate() {
    if (!lectureId || !poll.pollId) return;
    try {
      await nextApi.post(`/api/lectures/${lectureId}/poll/${poll.pollId}/activate`, {});
      setPoll((p) => ({ ...p, status: "active" }));
    } catch (err) {
      console.error("Failed to activate poll:", err);
    }
  }

  async function handleClose() {
    if (!lectureId || !poll.pollId) return;
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/poll/${poll.pollId}/close`, {});
      setPoll((p) => ({
        ...p,
        status: "closed",
        results: data.distribution ? {
          green: data.distribution.green || 0,
          yellow: data.distribution.yellow || 0,
          red: data.distribution.red || 0,
        } : null,
        totalResponses: data.totalResponses || 0,
      }));
    } catch (err) {
      console.error("Failed to close poll:", err);
    }
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
          <Button size="sm" onClick={handleGenerate} disabled={!lectureId || generating}>
            {generating ? "Generating..." : "Generate Question"}
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
              Waiting for responses...
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
                const total = poll.results!.green + poll.results!.yellow + poll.results!.red;
                const pct = total > 0 ? (poll.results![color] / total) * 100 : 0;
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
