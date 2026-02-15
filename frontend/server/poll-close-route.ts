/**
 * Express route for POST /api/lectures/:id/poll/:pollId/close
 *
 * Moved from Next.js to Express so Socket.IO emits work properly
 */

import { Router, json } from "express";
import { emitToLectureRoom } from "./socket-helpers";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// Lazy init
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

function getFlaskUrl(): string {
  return process.env.FLASK_API_URL || "http://localhost:5000";
}

async function flaskGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask GET ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function flaskPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask PUT ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// Misconception summary generation
async function generateMisconceptionSummary(
  question: string,
  responses: { answer: string; eval_result: string }[]
): Promise<string> {
  if (responses.length === 0) {
    return "No responses to analyze.";
  }

  const anthropic = getAnthropic();
  if (!anthropic) {
    return "Unable to generate summary (AI service unavailable).";
  }

  const responseList = responses
    .map((r, i) => `Student ${i + 1} (${r.eval_result}): "${r.answer}"`)
    .join("\n");

  const prompt = `You are analyzing student responses to a poll question to identify common misconceptions.

QUESTION: ${question}

STUDENT RESPONSES:
${responseList}

TASK:
Summarize the most common misconception or error pattern in 1-2 sentences. Focus on what students got wrong and why, so the professor can address it. If most students answered correctly, say so briefly.

Return ONLY a plain text summary (no JSON, no markdown). Example:
"Most students confused the chain rule with the product rule, applying the wrong differentiation formula to composite functions."`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    }, { timeout: 8000 });

    const content = message.content[0];
    if (content.type !== "text") {
      return "Unable to generate summary.";
    }

    let text = content.text.trim();
    // Strip wrapping quotes if Claude adds them
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }

    return text || "No clear misconception pattern detected.";
  } catch (err) {
    console.error("[poll-close] Misconception summary error:", err);
    return "Unable to generate summary.";
  }
}

router.post("/api/lectures/:id/poll/:pollId/close", json(), async (req, res) => {
  try {
    const { id: lectureId, pollId } = req.params;

    console.log(`[poll-close] Closing poll ${pollId} for lecture ${lectureId}`);

    // Update poll status to closed
    let poll: { id: string; status: string; question: string; concept_id: string };
    try {
      poll = await flaskPut(`/api/polls/${pollId}/status`, { status: "closed" });
    } catch (err) {
      console.error("[poll-close] Failed to update poll status:", err);
      return res.status(404).json({ error: "Poll not found" });
    }

    // Fetch all responses for this poll
    let responses: { answer: string; evaluation: { eval_result?: string } | null }[] = [];
    try {
      responses = await flaskGet<{ answer: string; evaluation: { eval_result?: string } | null }[]>(
        `/api/polls/${pollId}/responses`
      );
    } catch (err) {
      console.warn("[poll-close] Failed to fetch responses (poll may have no responses):", err);
      responses = [];
    }

    const totalResponses = responses?.length || 0;

    const parsedResponses = (responses || []).map((r) => ({
      answer: r.answer,
      eval_result: r.evaluation?.eval_result || "partial",
    }));

    // Try to get accurate distribution from Flask heatmap endpoint
    let distribution = { green: 0, yellow: 0, red: 0, gray: 0 };

    try {
      // Get course_id from lecture
      const lecture = await flaskGet<{ course_id: string }>(`/api/lectures/${lectureId}`);

      const heatmap = await flaskGet<{
        concepts: { id: string; distribution: { green: number; yellow: number; red: number; gray: number } }[];
      }>(`/api/courses/${lecture.course_id}/heatmap`);

      const conceptData = heatmap.concepts?.find((c: { id: string }) => c.id === poll.concept_id);
      if (conceptData?.distribution) {
        distribution = conceptData.distribution;
      }
    } catch (err) {
      console.warn("[poll-close] Heatmap unavailable, using eval_result counts:", err);
      // Heatmap endpoint not available — fall back to eval_result counts
      for (const r of parsedResponses) {
        if (r.eval_result === "correct") distribution.green++;
        else if (r.eval_result === "partial") distribution.yellow++;
        else distribution.red++;
      }
    }

    // Generate misconception summary via Claude Haiku
    let misconceptionSummary = "No summary available.";
    try {
      misconceptionSummary = await generateMisconceptionSummary(
        poll.question,
        parsedResponses
      );
    } catch (err) {
      console.warn("[poll-close] Failed to generate misconception summary:", err);
    }

    const results = { distribution, totalResponses, misconceptionSummary };

    // Emit poll:closed to the lecture room
    emitToLectureRoom(lectureId, "poll:closed", { pollId, results });

    console.log(`[poll-close] Success - poll ${pollId} closed, emitted to lecture room`);

    res.json({
      status: "closed",
      ...results,
    });

  } catch (err) {
    console.error("[poll-close] Error:", err);
    res.status(500).json({
      error: "Failed to close poll",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;
