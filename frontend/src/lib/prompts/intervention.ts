import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface ConceptDistribution {
  label: string;
  description: string;
  distribution: { green: number; yellow: number; red: number; gray: number };
}

interface InterventionSuggestion {
  concept_label: string;
  suggestion: string;
}

export interface EnrichedContext {
  recentTranscript?: string;
  pollSummaries?: {
    question: string;
    distribution: { correct: number; partial: number; wrong: number };
  }[];
}

export function buildInterventionPrompt(
  concepts: ConceptDistribution[],
  enrichedContext?: EnrichedContext
): string {
  const conceptSummaries = concepts
    .map(
      (c) =>
        `- ${c.label}: ${c.description}\n  Distribution: ${c.distribution.green} mastered, ${c.distribution.yellow} partial, ${c.distribution.red} struggling, ${c.distribution.gray} unvisited`
    )
    .join("\n");

  let transcriptSection = "";
  if (enrichedContext?.recentTranscript) {
    transcriptSection = `\n\nHere is what the professor has been explaining recently:\n"${enrichedContext.recentTranscript}"\nSuggest reinforcement that builds on what was said, rather than repeating it.`;
  }

  let pollSection = "";
  if (enrichedContext?.pollSummaries && enrichedContext.pollSummaries.length > 0) {
    const pollLines = enrichedContext.pollSummaries
      .map(
        (p) =>
          `- Q: "${p.question}" — ${p.distribution.correct} correct, ${p.distribution.partial} partial, ${p.distribution.wrong} wrong`
      )
      .join("\n");
    pollSection = `\n\nRecent quiz results:\n${pollLines}\nUse these to identify specific misunderstandings.`;
  }

  return `You are an expert teaching assistant analyzing class-wide understanding patterns.

The following concepts have students struggling. Each concept shows how many students fall into each mastery category:

${conceptSummaries}${transcriptSection}${pollSection}

For each concept, suggest a specific, actionable teaching strategy the professor could use RIGHT NOW in class to help struggling students. Produce 2-3 concise bullet points — the professor is glancing at this during a pause. Be concrete — suggest analogies, examples, activities, or explanations. Do not be generic.

Return valid JSON only, no markdown:
{ "suggestions": [{ "concept_label": "exact label from above", "suggestion": "1-2 sentence actionable strategy" }] }`;
}

export function parseInterventionResponse(
  response: string
): InterventionSuggestion[] {
  try {
    const jsonMatch = response.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    if (Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.map(
        (s: { concept_label?: string; suggestion?: string }) => ({
          concept_label: s.concept_label || "",
          suggestion: s.suggestion || "",
        })
      );
    }
    return [];
  } catch (e) {
    console.error("Failed to parse intervention response:", response);
    return [];
  }
}

export async function generateInterventions(
  concepts: ConceptDistribution[],
  enrichedContext?: EnrichedContext
): Promise<InterventionSuggestion[]> {
  const prompt = buildInterventionPrompt(concepts, enrichedContext);
  console.log("=== INTERVENTION DEBUG ===");
  console.log("Input concepts:", JSON.stringify(concepts, null, 2));

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    message.content[0].type === "text" ? message.content[0].text : "";
  console.log("Claude raw response:", content);

  const parsed = parseInterventionResponse(content);
  console.log("Parsed suggestions:", JSON.stringify(parsed, null, 2));
  console.log("=== END DEBUG ===");

  return parsed;
}
