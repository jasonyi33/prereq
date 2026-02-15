/**
 * Concept Detection — identifies which known concepts are discussed in a transcript chunk.
 *
 * Model: claude-haiku-4-5-20251001
 * Called by: Person 4's transcript route handler
 * Latency target: < 1 second
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export function buildConceptDetectionPrompt(
  transcriptChunk: string,
  conceptLabels: string[]
): string {
  return `You are analyzing a live lecture transcript to detect which concepts are being taught.

KNOWN CONCEPTS FOR THIS COURSE:
${conceptLabels.map((l) => `- ${l}`).join("\n")}

TRANSCRIPT CHUNK:
"${transcriptChunk}"

TASK:
Identify which of the known concepts above are being actively discussed or taught in this transcript chunk.

RULES:
- Only return a concept if it is a PRIMARY TOPIC of this chunk — the speaker is actively explaining, defining, deriving, or working through it in detail.
- Do NOT return a concept if it is merely:
  - Referenced as background context or a brief comparison ("unlike gradient descent, we...")
  - Mentioned as a transition to another topic ("now that we've covered X, let's move to...")
  - Used as a single word or phrase without substantive explanation
- When in doubt, do NOT include the concept. Prefer false negatives over false positives.
- Return an empty array if no concepts are being substantively taught.
- Only use labels from the provided list — do not invent new ones.

Return ONLY valid JSON (no markdown, no explanation):
{ "detected_concepts": ["label1", "label2"] }`;
}

export function parseConceptDetectionResponse(response: string): string[] {
  try {
    // Strip markdown code fences if Claude wraps the JSON
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    const parsed = JSON.parse(cleaned);
    if (
      parsed.detected_concepts &&
      Array.isArray(parsed.detected_concepts)
    ) {
      return parsed.detected_concepts;
    }
    return [];
  } catch {
    console.error(
      "Failed to parse concept detection response:",
      response
    );
    return [];
  }
}

/**
 * Detect concepts in a transcript chunk using Claude Haiku.
 * Person 4 imports this function in the transcript route handler.
 */
export async function detectConcepts(
  text: string,
  conceptLabels: string[]
): Promise<string[]> {
  if (conceptLabels.length === 0) return [];

  const prompt = buildConceptDetectionPrompt(text, conceptLabels);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  }, { timeout: 5000 });

  const content = message.content[0];
  if (content.type !== "text") return [];

  return parseConceptDetectionResponse(content.text);
}
