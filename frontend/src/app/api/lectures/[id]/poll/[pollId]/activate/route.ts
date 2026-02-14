import { NextRequest, NextResponse } from "next/server";
import { emitToLectureRoom } from "@server/socket-helpers";
import { flaskPut, flaskGet } from "@/lib/flask";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { id: lectureId, pollId } = await params;

  // Update poll status to active
  let poll: { id: string; status: string; question: string; concept_id: string };
  try {
    poll = await flaskPut(`/api/polls/${pollId}/status`, { status: "active" });
  } catch {
    return NextResponse.json(
      { error: "Poll not found" },
      { status: 404 }
    );
  }

  // Get concept label for the Socket.IO event
  let conceptLabel = "";
  try {
    const concept = await flaskGet<{ id: string; label: string }>(
      `/api/concepts/${poll.concept_id}`
    );
    conceptLabel = concept.label;
  } catch {
    // concept lookup failed — use empty label
  }

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
