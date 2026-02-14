import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";
import { emitToStudent, emitToProfessor } from "@server/socket-helpers";
import { evaluateResponse } from "@/lib/prompts/response-evaluation";

const FLASK_API_URL =
  process.env.FLASK_API_URL || "http://localhost:5000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const { pollId } = await params;
  const { studentId, answer } = (await request.json()) as {
    studentId: string;
    answer: string;
  };

  if (!studentId || !answer) {
    return NextResponse.json(
      { error: "studentId and answer are required" },
      { status: 400 }
    );
  }

  // Look up the poll question
  const { data: poll, error: pollErr } = await supabase
    .from("poll_questions")
    .select("id, question, expected_answer, concept_id, lecture_id")
    .eq("id", pollId)
    .single();

  if (pollErr || !poll) {
    return NextResponse.json(
      { error: "Poll not found" },
      { status: 404 }
    );
  }

  // Evaluate the student's answer with Claude Haiku
  const evaluation = await evaluateResponse(
    poll.question,
    poll.expected_answer,
    answer
  );

  // Store the poll response
  const { error: insertErr } = await supabase
    .from("poll_responses")
    .insert({
      question_id: pollId,
      student_id: studentId,
      answer,
      evaluation: {
        eval_result: evaluation.eval_result,
        feedback: evaluation.feedback,
        reasoning: evaluation.reasoning,
      },
    });

  if (insertErr) {
    console.error("Failed to insert poll response:", insertErr);
  }

  // Update mastery via Flask — pass eval_result, Flask applies confidence rules
  let masteryUpdate = {
    concept_id: poll.concept_id,
    old_color: "gray",
    new_color: "gray",
    confidence: 0,
  };

  try {
    const masteryRes = await fetch(
      `${FLASK_API_URL}/api/students/${studentId}/mastery/${poll.concept_id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eval_result: evaluation.eval_result }),
      }
    );
    if (masteryRes.ok) {
      masteryUpdate = await masteryRes.json();
    }
  } catch (e) {
    console.error("Failed to update mastery via Flask:", e);
  }

  // Emit mastery:updated to the specific student
  emitToStudent(studentId, "mastery:updated", {
    studentId,
    conceptId: poll.concept_id,
    oldColor: masteryUpdate.old_color,
    newColor: masteryUpdate.new_color,
    confidence: masteryUpdate.confidence,
  });

  // Emit heatmap:updated to the professor — frontend re-fetches from Flask
  emitToProfessor(poll.lecture_id, "heatmap:updated", {
    conceptId: poll.concept_id,
  });

  return NextResponse.json({
    evaluation: {
      eval_result: evaluation.eval_result,
      feedback: evaluation.feedback,
      reasoning: evaluation.reasoning,
    },
    updated: masteryUpdate,
  });
}
