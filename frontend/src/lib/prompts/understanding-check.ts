/**
 * Understanding Check — sidecar Haiku call after each tutoring message to detect mastery.
 *
 * Model: claude-haiku-4-5-20251001
 * Called after every student message in the tutoring flow.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export function buildUnderstandingCheckPrompt(
  studentMessage: string,
  targetConcepts: { label: string; description: string }[]
): string {
  const conceptList = targetConcepts
    .map((c) => `- ${c.label}: ${c.description}`)
    .join("\n");

  return `You are evaluating whether a student has demonstrated understanding of a concept during a tutoring session.

TARGET CONCEPTS THE STUDENT IS WORKING ON:
${conceptList}

STUDENT'S LATEST MESSAGE:
"${studentMessage}"

TASK:
Did the student demonstrate clear understanding of any of the target concepts in this message? Only say true if the student shows genuine comprehension — not just repeating words, but explaining the concept correctly in their own way.

Return ONLY valid JSON (no markdown, no explanation):
{ "understood": true/false, "concept_label": "label of the concept understood or empty string" }`;
}

export function parseUnderstandingCheckResponse(
  response: string
): { understood: boolean; concept_label: string } {
  try {
    const parsed = JSON.parse(response);
    return {
      understood: Boolean(parsed.understood),
      concept_label: parsed.concept_label || "",
    };
  } catch {
    console.error(
      "Failed to parse understanding check response:",
      response
    );
    return { understood: false, concept_label: "" };
  }
}

export async function checkUnderstanding(
  studentMessage: string,
  targetConcepts: { label: string; description: string }[]
): Promise<{ understood: boolean; concept_label: string }> {
  if (targetConcepts.length === 0) {
    return { understood: false, concept_label: "" };
  }

  const prompt = buildUnderstandingCheckPrompt(
    studentMessage,
    targetConcepts
  );

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 128,
    messages: [{ role: "user", content: prompt }],
  }, { timeout: 5000 });

  const content = message.content[0];
  if (content.type !== "text") {
    return { understood: false, concept_label: "" };
  }

  return parseUnderstandingCheckResponse(content.text);
}
