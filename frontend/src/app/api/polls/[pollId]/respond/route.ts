import { NextRequest, NextResponse } from "next/server";
import { emitToStudent, emitToProfessor } from "@server/socket-helpers";
import { evaluateResponse } from "@/lib/prompts/response-evaluation";
import { flaskGet, flaskPost, flaskPut } from "@/lib/flask";

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
  let poll: {
    id: string;
    question: string;
    expected_answer: string;
    concept_id: string;
    lecture_id: string;
  };
  try {
    poll = await flaskGet(`/api/polls/${pollId}`);
  } catch {
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

  // Store the poll response via Flask
  try {
    await flaskPost(`/api/polls/${pollId}/responses`, {
      student_id: studentId,
      answer,
      evaluation: {
        eval_result: evaluation.eval_result,
        feedback: evaluation.feedback,
        reasoning: evaluation.reasoning,
      },
    });
  } catch (e) {
    console.error("Failed to insert poll response:", e);
  }

  // Update mastery via Flask — pass eval_result, Flask applies confidence rules
  let masteryUpdate = {
    concept_id: poll.concept_id,
    old_color: "gray",
    new_color: "gray",
    confidence: 0,
  };

  try {
    masteryUpdate = await flaskPut(
      `/api/students/${studentId}/mastery/${poll.concept_id}`,
      { eval_result: evaluation.eval_result }
    );
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
