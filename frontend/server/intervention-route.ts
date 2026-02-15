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
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask GET ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface ConceptDistribution {
  label: string;
  description: string;
  distribution: { green: number; yellow: number; red: number; gray: number };
}

interface EnrichedContext {
  recentTranscript?: string;
  pollSummaries?: {
    question: string;
    distribution: { correct: number; partial: number; wrong: number };
  }[];
}

function buildInterventionPrompt(
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
    const lecture = await flaskGet<{ id: string; course_id: string }>(`/api/lectures/${lectureId}`);

    // Fetch heatmap from Flask
    const heatmap = await flaskGet<{
      concepts: {
        id: string;
        label: string;
        distribution: { green: number; yellow: number; red: number; gray: number };
        avg_confidence: number;
      }[];
    }>(`/api/courses/${lecture.course_id}/heatmap`);

    // Fetch concept descriptions
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

    // Fetch enriched context (best-effort, failures don't block)
    const [transcriptChunks, polls] = await Promise.all([
      flaskGet<{ text: string; timestamp_sec: number }[]>(
        `/api/lectures/${lectureId}/transcript-chunks?limit=10`
      ).catch(() => [] as { text: string; timestamp_sec: number }[]),
      flaskGet<{ id: string; status: string; question: string }[]>(
        `/api/lectures/${lectureId}/polls`
      ).catch(() => [] as { id: string; status: string; question: string }[]),
    ]);

    const enrichedContext: EnrichedContext = {};

    if (transcriptChunks.length > 0) {
      enrichedContext.recentTranscript = [...transcriptChunks]
        .reverse()
        .map((c) => c.text)
        .join(" ");
    }

    const closedPolls = polls.filter((p) => p.status === "closed").slice(-2);
    if (closedPolls.length > 0) {
      const pollSummaries = await Promise.all(
        closedPolls.map(async (poll) => {
          const responses = await flaskGet<
            { evaluation: { eval_result?: string } | null }[]
          >(`/api/polls/${poll.id}/responses`).catch(
            () => [] as { evaluation: { eval_result?: string } | null }[]
          );
          const dist = { correct: 0, partial: 0, wrong: 0 };
          for (const r of responses) {
            const result = r.evaluation?.eval_result;
            if (result === "correct") dist.correct++;
            else if (result === "partial") dist.partial++;
            else if (result === "wrong") dist.wrong++;
          }
          return { question: poll.question, distribution: dist };
        })
      );
      enrichedContext.pollSummaries = pollSummaries;
    }

    // Generate intervention suggestions via Claude
    const anthropic = getAnthropic();
    if (!anthropic) {
      return res.status(500).json({ error: "AI service not configured" });
    }

    const prompt = buildInterventionPrompt(targetConcepts, enrichedContext);
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }, { timeout: 15000 });

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
