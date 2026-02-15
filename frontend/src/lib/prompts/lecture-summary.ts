/**
 * Lecture Summary — generates a bullet-point summary of a completed lecture.
 *
 * Model: claude-haiku-4-5-20251001
 * Called by: POST /api/lectures/:id/summary route after RTMS stops
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export function buildLectureSummaryPrompt(
  transcriptText: string,
  conceptLabels: string[]
): string {
  return `You are summarizing a university lecture for students.

CONCEPTS COVERED IN THIS COURSE:
${conceptLabels.map((l) => `- ${l}`).join("\n")}

FULL TRANSCRIPT:
"${transcriptText}"

TASK:
Create a concise summary of what was taught in this lecture.

Return ONLY valid JSON (no markdown, no explanation):
{
  "bullets": ["Point 1...", "Point 2...", ...],
  "title_summary": "One-line lecture title"
}

RULES:
- 4-6 bullet points, each 1-2 sentences
- Focus on key concepts explained and their relationships
- Use plain language a student would understand
- title_summary should be ~5-8 words
- If the transcript is very short or empty, still provide a brief summary`;
}

export function parseLectureSummaryResponse(response: string): {
  bullets: string[];
  titleSummary: string;
} {
  try {
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }
    const parsed = JSON.parse(cleaned);
    return {
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
      titleSummary: parsed.title_summary || "Lecture Summary",
    };
  } catch {
    console.error("Failed to parse lecture summary response:", response);
    return { bullets: ["Lecture summary could not be generated."], titleSummary: "Lecture Summary" };
  }
}

export async function generateLectureSummary(
  transcriptText: string,
  conceptLabels: string[]
): Promise<{ bullets: string[]; titleSummary: string }> {
  if (!transcriptText.trim()) {
    return { bullets: ["No transcript content was recorded for this lecture."], titleSummary: "Lecture Summary" };
  }

  const prompt = buildLectureSummaryPrompt(transcriptText, conceptLabels);

  const message = await anthropic.messages.create(
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: 15000 }
  );

  const content = message.content[0];
  if (content.type !== "text") {
    return { bullets: ["Lecture summary could not be generated."], titleSummary: "Lecture Summary" };
  }

  return parseLectureSummaryResponse(content.text);
}
