"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { nextApi } from "@/lib/api";

interface PollCardProps {
  pollId: string;
  question: string;
  conceptLabel: string;
  studentId: string;
}

export default function PollCard({ pollId, question, conceptLabel, studentId }: PollCardProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const res = await nextApi.post(`/api/polls/${pollId}/respond`, {
        studentId,
        answer: answer.trim(),
      });
      setFeedback(res.evaluation?.feedback || "Answer submitted.");
      setSubmitted(true);
    } catch {
      setFeedback("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Poll Question</CardTitle>
          <Badge variant="outline" className="text-xs">{conceptLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{question}</p>
        <Textarea
          placeholder="Type your answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          rows={3}
        />
        {!submitted && (
          <Button size="sm" onClick={handleSubmit} disabled={loading || !answer.trim()}>
            {loading ? "Submitting..." : "Submit"}
          </Button>
        )}
        {feedback && (
          <p className="text-sm text-muted-foreground italic">{feedback}</p>
        )}
      </CardContent>
    </Card>
  );
}
