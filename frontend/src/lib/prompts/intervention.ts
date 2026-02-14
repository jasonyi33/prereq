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

export function buildInterventionPrompt(
  concepts: ConceptDistribution[]
): string {
  const conceptSummaries = concepts
    .map(
      (c) =>
        `- ${c.label}: ${c.description}\n  Distribution: ${c.distribution.green} mastered, ${c.distribution.yellow} partial, ${c.distribution.red} struggling, ${c.distribution.gray} unvisited`
    )
    .join("\n");

  return `You are an expert teaching assistant analyzing class-wide understanding patterns.

The following concepts have students struggling. Each concept shows how many students fall into each mastery category:

${conceptSummaries}

For each concept, suggest a specific, actionable teaching strategy the professor could use RIGHT NOW in class to help struggling students. Be concrete — suggest analogies, examples, activities, or explanations. Do not be generic.

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
  concepts: ConceptDistribution[]
): Promise<InterventionSuggestion[]> {
  const prompt = buildInterventionPrompt(concepts);
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
