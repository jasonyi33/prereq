/**
 * Express route for POST /api/lectures/:id/poll/generate
 *
 * Moved from Next.js API route to Express to ensure environment variables work
 */

import { Router, json } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// Lazy init
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("[poll-generate] ANTHROPIC_API_KEY not set");
    return null;
  }
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

async function flaskPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask POST ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// Question generation
function buildPrompt(conceptLabel: string, conceptDescription: string, recentTranscript: string): string {
  return `You are generating a poll question for a live university lecture.

CONCEPT: ${conceptLabel}
DESCRIPTION: ${conceptDescription}

RECENT LECTURE TRANSCRIPT:
"${recentTranscript}"

TASK:
Generate a SHORT, CLEAN question that tests real understanding of this concept.

REQUIREMENTS:
- Keep the question concise (1 sentence, max 15 words)
- Ask something fundamental that reveals understanding vs confusion
- Make it answerable in 1-2 short sentences
- No multiple choice - open-ended but focused
- Be direct and clear

EXAMPLES OF GOOD QUESTIONS:
- "What does the learning rate control in gradient descent?"
- "Why do we use ReLU instead of sigmoid in hidden layers?"
- "How does dropout prevent overfitting?"

Also provide a brief expected answer (2-3 sentences max).

Return ONLY valid JSON (no markdown, no explanation):
{ "question": "...", "expected_answer": "..." }`;
}

function parseResponse(response: string): { question: string; expectedAnswer: string } {
  let cleaned = response.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  const parsed = JSON.parse(cleaned);
  return {
    question: parsed.question || "",
    expectedAnswer: parsed.expected_answer || "",
  };
}

router.post("/api/lectures/:id/poll/generate", json(), async (req, res) => {
  try {
    const lectureId = req.params.id;
    const { conceptId } = req.body as { conceptId?: string };

    console.log(`[poll-generate] Generating for lecture ${lectureId}, concept ${conceptId || 'auto'}`);

    // Get lecture info
    const lecture = await flaskGet<{ id: string; course_id: string }>(`/api/lectures/${lectureId}`);
    console.log(`[poll-generate] Lecture course: ${lecture.course_id}`);

    // Get course graph
    const graph = await flaskGet<{ nodes: { id: string; label: string; description?: string }[] }>(
      `/api/courses/${lecture.course_id}/graph`
    );

    // Determine concept
    let targetConceptId = conceptId;
    if (!targetConceptId) {
      try {
        const recent = await flaskGet<{ concept_id: string }>(`/api/lectures/${lectureId}/recent-concept`);
        targetConceptId = recent.concept_id;
      } catch {
        // No recent concept, pick random
        if (graph.nodes.length === 0) {
          return res.status(400).json({ error: "No concepts available in this course" });
        }
        targetConceptId = graph.nodes[Math.floor(Math.random() * graph.nodes.length)].id;
      }
    }

    const concept = graph.nodes.find((n) => n.id === targetConceptId);
    if (!concept) {
      return res.status(404).json({ error: "Concept not found" });
    }

    console.log(`[poll-generate] Target concept: ${concept.label}`);

    // Get recent transcript
    let recentTranscript = "";
    try {
      const chunks = await flaskGet<{ text: string; timestamp_sec: number }[]>(
        `/api/lectures/${lectureId}/transcript-chunks?limit=5`
      );
      recentTranscript = (chunks || []).reverse().map((c) => c.text).join(" ");
    } catch (err) {
      console.warn("[poll-generate] No transcript chunks:", err);
    }

    // Generate question with Claude
    const anthropic = getAnthropic();
    if (!anthropic) {
      return res.status(500).json({ error: "AI service not configured" });
    }

    const prompt = buildPrompt(concept.label, concept.description || "", recentTranscript);
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }, { timeout: 15000 });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const { question, expectedAnswer } = parseResponse(content.text);
    console.log(`[poll-generate] Generated question: ${question.slice(0, 50)}...`);

    // Insert poll via Flask
    const poll = await flaskPost<{ id: string }>("/api/polls", {
      lecture_id: lectureId,
      concept_id: targetConceptId,
      question,
      expected_answer: expectedAnswer,
      status: "draft",
    });

    res.json({
      pollId: poll.id,
      question,
      expectedAnswer,
      conceptId: targetConceptId,
      conceptLabel: concept.label,
    });

  } catch (err) {
    console.error("[poll-generate] Error:", err);
    res.status(500).json({
      error: "Failed to generate question",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;