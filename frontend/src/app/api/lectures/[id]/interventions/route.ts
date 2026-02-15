import { NextRequest, NextResponse } from "next/server";
import { generateInterventions, type EnrichedContext } from "@/lib/prompts/intervention";
import { flaskGet } from "@/lib/flask";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;
  const { conceptIds } = (await request.json()) as {
    conceptIds: string[];
  };

  console.log("=== INTERVENTIONS ROUTE DEBUG ===");
  console.log("Received conceptIds:", conceptIds);

  if (!conceptIds || conceptIds.length === 0) {
    return NextResponse.json(
      { error: "conceptIds array is required" },
      { status: 400 }
    );
  }

  // Get course_id from lecture
  let lecture: { id: string; course_id: string };
  try {
    lecture = await flaskGet(`/api/lectures/${lectureId}`);
  } catch {
    return NextResponse.json(
      { error: "Lecture not found" },
      { status: 404 }
    );
  }

  try {
    // Fetch heatmap from Flask
    const heatmap = await flaskGet<{
      concepts: {
        id: string;
        label: string;
        distribution: { green: number; yellow: number; red: number; gray: number };
        avg_confidence: number;
      }[];
    }>(`/api/courses/${lecture.course_id}/heatmap`);

    // Also fetch concept descriptions
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
      .filter(Boolean) as {
        label: string;
        description: string;
        distribution: { green: number; yellow: number; red: number; gray: number };
      }[];

    console.log("Target concepts to send to Claude:", JSON.stringify(targetConcepts, null, 2));

    if (targetConcepts.length === 0) {
      return NextResponse.json(
        { error: "No matching concepts found in heatmap" },
        { status: 404 }
      );
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

    // Transcript: chunks come back newest-first, reverse for chronological
    if (transcriptChunks.length > 0) {
      enrichedContext.recentTranscript = [...transcriptChunks]
        .reverse()
        .map((c) => c.text)
        .join(" ");
    }

    // Polls: filter to closed, take last 2, fetch response distributions
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

    // Generate intervention suggestions via Claude Sonnet
    const rawSuggestions = await generateInterventions(targetConcepts, enrichedContext);
    console.log("Raw suggestions from generateInterventions:", rawSuggestions);

    // Map concept labels back to IDs
    const labelToId = new Map(concepts.map((c) => [c.label, c.id]));
    const suggestions = rawSuggestions.map((s) => ({
      conceptId: labelToId.get(s.concept_label) || "",
      conceptLabel: s.concept_label,
      suggestion: s.suggestion,
    }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Intervention generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate teaching suggestions. Please try again." },
      { status: 500 }
    );
  }
}
