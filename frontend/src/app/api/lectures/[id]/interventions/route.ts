import { NextRequest, NextResponse } from "next/server";
import { generateInterventions } from "@/lib/prompts/intervention";
import { flaskGet } from "@/lib/flask";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;
  const { conceptIds } = (await request.json()) as {
    conceptIds: string[];
  };

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

  if (targetConcepts.length === 0) {
    return NextResponse.json(
      { error: "No matching concepts found in heatmap" },
      { status: 404 }
    );
  }

  // Generate intervention suggestions via Claude Sonnet
  const rawSuggestions = await generateInterventions(targetConcepts);

  // Map concept labels back to IDs
  const labelToId = new Map(concepts.map((c) => [c.label, c.id]));
  const suggestions = rawSuggestions.map((s) => ({
    conceptId: labelToId.get(s.concept_label) || "",
    conceptLabel: s.concept_label,
    suggestion: s.suggestion,
  }));

  return NextResponse.json({ suggestions });
}
