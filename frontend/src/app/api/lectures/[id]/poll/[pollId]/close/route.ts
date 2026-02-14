import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";
import { emitToLectureRoom } from "@server/socket-helpers";
import { generateMisconceptionSummary } from "@/lib/prompts/misconception-summary";

const FLASK_API_URL =
  process.env.FLASK_API_URL || "http://localhost:5000";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { id: lectureId, pollId } = await params;

  // Update poll status to closed
  const { data: poll, error: pollErr } = await supabase
    .from("poll_questions")
    .update({ status: "closed" })
    .eq("id", pollId)
    .select("id, question, concept_id, lecture_id")
    .single();

  if (pollErr || !poll) {
    return NextResponse.json(
      { error: "Poll not found" },
      { status: 404 }
    );
  }

  // Fetch all responses for this poll
  const { data: responses } = await supabase
    .from("poll_responses")
    .select("answer, evaluation")
    .eq("question_id", pollId);

  const totalResponses = responses?.length || 0;

  const parsedResponses = (responses || []).map(
    (r: { answer: string; evaluation: { eval_result?: string } | null }) => ({
      answer: r.answer,
      eval_result: r.evaluation?.eval_result || "partial",
    })
  );

  // Try to get accurate distribution from Flask heatmap endpoint
  let distribution = { green: 0, yellow: 0, red: 0, gray: 0 };

  try {
    // Get course_id from lecture
    const { data: lecture } = await supabase
      .from("lecture_sessions")
      .select("course_id")
      .eq("id", lectureId)
      .single();

    if (lecture) {
      const heatmapRes = await fetch(
        `${FLASK_API_URL}/api/courses/${lecture.course_id}/heatmap`
      );
      if (heatmapRes.ok) {
        const heatmap = await heatmapRes.json();
        const conceptData = heatmap.concepts?.find(
          (c: { id: string }) => c.id === poll.concept_id
        );
        if (conceptData?.distribution) {
          distribution = conceptData.distribution;
        }
      }
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
