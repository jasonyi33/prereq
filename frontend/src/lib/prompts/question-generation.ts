/**
 * Question Generation — generates a poll question for a concept based on lecture context.
 *
 * Model: claude-sonnet-4-5-20250929
 * Called by: POST /api/lectures/[id]/poll/generate
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export function buildQuestionGenerationPrompt(
  conceptLabel: string,
  conceptDescription: string,
  recentTranscript: string
): string {
  return `You are generating a poll question for a live university lecture.

CONCEPT: ${conceptLabel}
DESCRIPTION: ${conceptDescription}

RECENT LECTURE TRANSCRIPT:
"${recentTranscript}"

TASK:
Generate a natural language question that tests whether a student truly understands this concept. The question should:
- Test real understanding, not just recall or trivia
- Be answerable in 2-3 sentences of natural language (not multiple choice)
- Reference the lecture context if possible
- Be clear and unambiguous

Also provide an expected answer that captures the key points a correct response should include.

Return ONLY valid JSON (no markdown, no explanation):
{ "question": "...", "expected_answer": "..." }`;
}

export function parseQuestionGenerationResponse(
  response: string
): { question: string; expectedAnswer: string } {
  try {
    const parsed = JSON.parse(response);
    return {
      question: parsed.question || "",
      expectedAnswer: parsed.expected_answer || "",
    };
  } catch {
    console.error(
      "Failed to parse question generation response:",
      response
    );
    throw new Error("Failed to parse question generation response");
  }
}

export async function generateQuestion(
  conceptLabel: string,
  conceptDescription: string,
  recentTranscript: string
): Promise<{ question: string; expectedAnswer: string }> {
  const prompt = buildQuestionGenerationPrompt(
    conceptLabel,
    conceptDescription,
    recentTranscript
  );

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return parseQuestionGenerationResponse(content.text);
}
