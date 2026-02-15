import { NextRequest, NextResponse } from "next/server";
import { flaskGet, flaskPut } from "@/lib/flask";
import { generateLectureSummary } from "@/lib/prompts/lecture-summary";
import { emitToLectureRoom } from "@server/socket-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;

  try {
    // Check if summary already exists (idempotent)
    const lecture = await flaskGet<{ course_id: string; summary?: unknown }>(
      `/api/lectures/${lectureId}`
    );
    if (lecture.summary) {
      return NextResponse.json({ summary: lecture.summary, cached: true });
    }

    // Fetch transcript chunks (returned DESC, reverse for chronological)
    const chunks = await flaskGet<{ text: string; timestamp_sec: number }[]>(
      `/api/lectures/${lectureId}/transcript-chunks`
    );
    const chronological = [...chunks].reverse();
    const fullTranscript = chronological.map((c) => c.text).join("\n");

    if (!fullTranscript.trim()) {
      return NextResponse.json({ error: "No transcript content" }, { status: 400 });
    }

    // Fetch concept labels from the course graph
    const graph = await flaskGet<{ nodes: { id: string; label: string }[] }>(
      `/api/courses/${lecture.course_id}/graph`
    );
    const conceptLabels = graph.nodes.map((n) => n.label);

    // Fetch covered concept IDs for this lecture
    const { concept_ids: coveredConceptIds } = await flaskGet<{ concept_ids: string[] }>(
      `/api/lectures/${lectureId}/covered-concepts`
    );

    // Determine lecture number (chronological order)
    const allLectures = await flaskGet<{ id: string; started_at: string }[]>(
      `/api/courses/${lecture.course_id}/lectures`
    );
    // API returns desc order, reverse for chronological
    const chronologicalLectures = [...allLectures].reverse();
    const lectureNumber = chronologicalLectures.findIndex((l) => l.id === lectureId) + 1;

    // Generate summary via Claude
    const { bullets, titleSummary } = await generateLectureSummary(
      fullTranscript,
      conceptLabels
    );

    // Build summary object and store via Flask
    const summary = {
      bullets,
      covered_concept_ids: coveredConceptIds,
      title_summary: `Lecture ${lectureNumber || "?"}: ${titleSummary}`,
    };

    await flaskPut(`/api/lectures/${lectureId}`, { summary });

    // Emit to connected students
    emitToLectureRoom(lectureId, "lecture:summary-ready", {
      lectureId,
      summary,
    });

    return NextResponse.json({ summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Summary] Failed for lecture ${lectureId}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
