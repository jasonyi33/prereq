/**
 * Misconception Summary — analyzes student responses to identify common errors when closing a poll.
 *
 * Model: claude-haiku-4-5-20251001
 * Called by: POST /api/lectures/[id]/poll/[pollId]/close
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export function buildMisconceptionSummaryPrompt(
  question: string,
  responses: { answer: string; eval_result: string }[]
): string {
  const responseList = responses
    .map((r, i) => `Student ${i + 1} (${r.eval_result}): "${r.answer}"`)
    .join("\n");

  return `You are analyzing student responses to a poll question to identify common misconceptions.

QUESTION: ${question}

STUDENT RESPONSES:
${responseList}

TASK:
Summarize the most common misconception or error pattern in 1-2 sentences. Focus on what students got wrong and why, so the professor can address it. If most students answered correctly, say so briefly.

Return ONLY a plain text summary (no JSON, no markdown). Example:
"Most students confused the chain rule with the product rule, applying the wrong differentiation formula to composite functions."`;
}

export function parseMisconceptionSummaryResponse(response: string): string {
  // Plain text — just trim and return
  const trimmed = response.trim();
  if (!trimmed) {
    return "No clear misconception pattern detected.";
  }
  // Strip wrapping quotes if Claude adds them
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export async function generateMisconceptionSummary(
  question: string,
  responses: { answer: string; eval_result: string }[]
): Promise<string> {
  if (responses.length === 0) {
    return "No responses to analyze.";
  }

  const prompt = buildMisconceptionSummaryPrompt(question, responses);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return "Unable to generate summary.";
  }

  return parseMisconceptionSummaryResponse(content.text);
}
