import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";
import { emitToLectureRoom } from "@server/socket-helpers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { id: lectureId, pollId } = await params;

  // Update poll status to active
  const { data: poll, error } = await supabase
    .from("poll_questions")
    .update({ status: "active" })
    .eq("id", pollId)
    .select("id, question, concept_id")
    .single();

  if (error || !poll) {
    return NextResponse.json(
      { error: "Poll not found" },
      { status: 404 }
    );
  }

  // Get concept label for the Socket.IO event
  const { data: concept } = await supabase
    .from("concept_nodes")
    .select("label")
    .eq("id", poll.concept_id)
    .single();

  const conceptLabel = concept?.label || "";

  // Emit to all students in the lecture room
  emitToLectureRoom(lectureId, "poll:new-question", {
    pollId,
    question: poll.question,
    conceptLabel,
  });

  // In demo mode, trigger auto-responder for simulated students
  if (process.env.DEMO_MODE === "true") {
    try {
      // Dynamic import — P4's auto-responder may not exist yet
      const { onPollActivated } = await import(
        "@server/auto-responder"
      );
      onPollActivated(pollId, poll.question, conceptLabel);
    } catch {
      // Auto-responder not available yet — that's fine
    }
  }

  return NextResponse.json({ status: "active" });
}
