/**
 * Express route for POST /api/lectures/:id/interventions
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
    console.error("[intervention] ANTHROPIC_API_KEY not set");
    return null;
  }
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

function getFlaskUrl(): string {
  return process.env.FLASK_API_URL || "http://localhost:5000";
}

async function flaskGet<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout per request

  try {
    console.log(`[intervention] Flask GET: ${getFlaskUrl()}${path}`);
    const res = await fetch(`${getFlaskUrl()}${path}`, {
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[intervention] Flask GET failed: ${res.status} - ${text.slice(0, 200)}`);
      throw new Error(`Flask GET ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
    }
    console.log(`[intervention] Flask GET success: ${path}`);
    return res.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timeout);
    console.error(`[intervention] Flask GET error: ${err}`);
    throw err;
  }
}

interface ConceptDistribution {
  label: string;
  description: string;
  distribution: { green: number; yellow: number; red: number; gray: number };
}

function buildInterventionPrompt(concepts: ConceptDistribution[]): string {
  const conceptSummaries = concepts
    .map(
      (c) =>
        `- ${c.label}: ${c.description}\n  Distribution: ${c.distribution.green} mastered, ${c.distribution.yellow} partial, ${c.distribution.red} struggling, ${c.distribution.gray} unvisited`
    )
    .join("\n");

  return `You are an expert teaching assistant analyzing class-wide understanding patterns.

The following concepts have students struggling. Each concept shows how many students fall into each mastery category:

${conceptSummaries}

For each concept, suggest a specific, actionable teaching strategy the professor could use RIGHT NOW in class to help struggling students. Produce 2-3 concise bullet points — the professor is glancing at this during a pause. Be concrete — suggest analogies, examples, activities, or explanations. Do not be generic.

Return valid JSON only, no markdown:
{ "suggestions": [{ "concept_label": "exact label from above", "suggestion": "1-2 sentence actionable strategy" }] }`;
}

function parseInterventionResponse(
  response: string
): { concept_label: string; suggestion: string }[] {
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
    console.error("[intervention] Failed to parse response:", response);
    return [];
  }
}

router.post("/api/lectures/:id/interventions", json(), async (req, res) => {
  try {
    const lectureId = req.params.id;
    const { conceptIds } = req.body as { conceptIds: string[] };

    console.log(`[intervention] Generating for lecture ${lectureId}, concepts: ${conceptIds?.length || 0}`);

    if (!conceptIds || conceptIds.length === 0) {
      return res.status(400).json({ error: "conceptIds array is required" });
    }

    // Get course_id from lecture
    console.log("[intervention] Fetching lecture...");
    const lecture = await flaskGet<{ id: string; course_id: string }>(`/api/lectures/${lectureId}`);

    // Fetch heatmap from Flask
    console.log("[intervention] Fetching heatmap...");
    const heatmap = await flaskGet<{
      concepts: {
        id: string;
        label: string;
        distribution: { green: number; yellow: number; red: number; gray: number };
        avg_confidence: number;
      }[];
    }>(`/api/courses/${lecture.course_id}/heatmap`);

    // Fetch concept descriptions
    console.log("[intervention] Fetching concept descriptions...");
    const concepts = await flaskGet<
      { id: string; label: string; description: string }[]
    >(`/api/concepts?ids=${conceptIds.join(",")}`);

    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    // Filter heatmap to requested concepts and enrich with descriptions
    const targetConcepts = conceptIds
      .map((id) => {
        const heatmapEntry = heatmap.concepts?.find((c) => c.id === id);
        const conceptDetail = conceptMap.get(id);
        if (!heatmapEntry || !conceptDetail) return null;
        return {
          label: heatmapEntry.label,
          description: conceptDetail.description || "",
          distribution: heatmapEntry.distribution,
        };
      })
      .filter(Boolean) as ConceptDistribution[];

    if (targetConcepts.length === 0) {
      return res.status(404).json({ error: "No matching concepts found in heatmap" });
    }

    // Generate intervention suggestions via Claude (removed slow enriched context)
    console.log("[intervention] Generating suggestions with Claude...");
    const anthropic = getAnthropic();
    if (!anthropic) {
      return res.status(500).json({ error: "AI service not configured" });
    }

    const prompt = buildInterventionPrompt(targetConcepts);
    console.log(`[intervention] Calling Claude with ${targetConcepts.length} concepts...`);
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }, { timeout: 30000 });
    console.log(`[intervention] Claude response received`);

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const rawSuggestions = parseInterventionResponse(content.text);

    // Map concept labels back to IDs
    const labelToId = new Map(concepts.map((c) => [c.label, c.id]));
    const suggestions = rawSuggestions.map((s) => ({
      conceptId: labelToId.get(s.concept_label) || "",
      conceptLabel: s.concept_label,
      suggestion: s.suggestion,
    }));

    console.log(`[intervention] Success - generated ${suggestions.length} suggestions`);
    res.json({ suggestions });
  } catch (err) {
    console.error("[intervention] Error:", err);
    res.status(500).json({
      error: "Failed to generate teaching suggestions",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
