/**
 * Express route for POST /api/lectures/:id/poll/:pollId/activate
 *
 * Moved from Next.js to Express so Socket.IO emits work properly
 */

import { Router, json } from "express";
import { emitToLectureRoom } from "./socket-helpers";

const router = Router();
router.use(json());

function getFlaskUrl(): string {
  return process.env.FLASK_API_URL || "http://localhost:5000";
}

async function flaskPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask PUT ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
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

router.post("/api/lectures/:id/poll/:pollId/activate", async (req, res) => {
  try {
    const { id: lectureId, pollId } = req.params;

    console.log(`[poll-activate] Activating poll ${pollId} for lecture ${lectureId}`);

    // Update poll status to active
    const poll = await flaskPut<{ id: string; status: string; question: string; concept_id: string }>(
      `/api/polls/${pollId}/status`,
      { status: "active" }
    );

    console.log(`[poll-activate] Poll activated: ${poll.question.slice(0, 50)}...`);

    // Get concept label for the Socket.IO event
    let conceptLabel = "";
    try {
      const concept = await flaskGet<{ id: string; label: string }>(`/api/concepts/${poll.concept_id}`);
      conceptLabel = concept.label;
    } catch (err) {
      console.warn("[poll-activate] Could not fetch concept label:", err);
    }

    // Emit to ALL students in the lecture room
    console.log(`[poll-activate] Emitting poll:new-question to lecture room ${lectureId}`);
    emitToLectureRoom(lectureId, "poll:new-question", {
      pollId,
      question: poll.question,
      conceptLabel,
    });

    // In demo mode, trigger auto-responder
    if (process.env.DEMO_MODE === "true") {
      try {
        const { onPollActivated } = await import("./auto-responder");
        onPollActivated(pollId, poll.question, conceptLabel);
      } catch {
        // Auto-responder not available
      }
    }

    console.log(`[poll-activate] Success - poll ${pollId} sent to students`);
    res.json({ status: "active" });

  } catch (err) {
    console.error("[poll-activate] Error:", err);
    res.status(500).json({
      error: "Failed to activate poll",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;