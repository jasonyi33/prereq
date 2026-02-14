import { NextRequest, NextResponse } from "next/server";
import { emitToLectureRoom } from "@server/socket-helpers";
import { generateMisconceptionSummary } from "@/lib/prompts/misconception-summary";
import { flaskPut, flaskGet } from "@/lib/flask";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { id: lectureId, pollId } = await params;

  // Update poll status to closed
  let poll: { id: string; status: string; question: string; concept_id: string };
  try {
    poll = await flaskPut(`/api/polls/${pollId}/status`, { status: "closed" });
  } catch {
    return NextResponse.json(
      { error: "Poll not found" },
      { status: 404 }
    );
  }

  // Fetch all responses for this poll
  const responses = await flaskGet<{ answer: string; evaluation: { eval_result?: string } | null }[]>(
    `/api/polls/${pollId}/responses`
  );

  const totalResponses = responses?.length || 0;

  const parsedResponses = (responses || []).map((r) => ({
    answer: r.answer,
    eval_result: r.evaluation?.eval_result || "partial",
  }));

  // Try to get accurate distribution from Flask heatmap endpoint
  let distribution = { green: 0, yellow: 0, red: 0, gray: 0 };

  try {
    // Get course_id from lecture
    const lecture = await flaskGet<{ course_id: string }>(
      `/api/lectures/${lectureId}`
    );

    const heatmap = await flaskGet<{
      concepts: { id: string; distribution: { green: number; yellow: number; red: number; gray: number } }[];
    }>(`/api/courses/${lecture.course_id}/heatmap`);
    const conceptData = heatmap.concepts?.find(
      (c: { id: string }) => c.id === poll.concept_id
    );
    if (conceptData?.distribution) {
      distribution = conceptData.distribution;
    }
  } catch {
    // Heatmap endpoint not available yet — fall back to eval_result counts
    for (const r of parsedResponses) {
      if (r.eval_result === "correct") distribution.green++;
      else if (r.eval_result === "partial") distribution.yellow++;
      else distribution.red++;
    }
  }

  // Generate misconception summary via Claude Haiku
  const misconceptionSummary = await generateMisconceptionSummary(
    poll.question,
    parsedResponses
  );

  const results = { distribution, totalResponses, misconceptionSummary };

  // Emit poll:closed to the lecture room
  emitToLectureRoom(lectureId, "poll:closed", { pollId, results });

  return NextResponse.json({
    status: "closed",
    ...results,
  });
}
