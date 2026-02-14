import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildTutoringSystemPrompt } from "@/lib/prompts/tutoring";
import { checkUnderstanding } from "@/lib/prompts/understanding-check";
import { emitToStudent } from "@server/socket-helpers";
import { flaskGet, flaskPost, flaskPut } from "@/lib/flask";

const anthropic = new Anthropic();

// GET: Fetch all messages for a tutoring session
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const messages = await flaskGet<
    { id: string; role: string; content: string; created_at: string }[]
  >(`/api/tutoring/sessions/${sessionId}/messages?exclude_role=system`);

  return NextResponse.json({
    messages: (messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  });
}

// POST: Send a student message and get AI response + understanding check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const { content } = (await request.json()) as { content: string };

  if (!content) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  // Fetch the session to get student_id and target_concepts
  let session: { id: string; student_id: string; target_concepts: string[] };
  try {
    session = await flaskGet(`/api/tutoring/sessions/${sessionId}`);
  } catch {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // 1. Insert the student's message
  await flaskPost(`/api/tutoring/sessions/${sessionId}/messages`, {
    role: "user",
    content,
  });

  // 2. Load full conversation history
  const allMessages = await flaskGet<
    { id: string; role: string; content: string; created_at: string }[]
  >(`/api/tutoring/sessions/${sessionId}/messages`);

  // Separate system prompt from conversation
  const systemMessage = (allMessages || []).find((m) => m.role === "system");
  const conversationHistory = (allMessages || [])
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // 3. Rebuild system prompt if no stored one (fallback)
  let systemPrompt = systemMessage?.content || "";
  if (!systemPrompt) {
    // Fetch weak concepts and rebuild
    let masteryData: { concept_id: string; confidence: number }[] = [];
    try {
      masteryData = await flaskGet(`/api/students/${session.student_id}/mastery`);
    } catch {
      // mastery fetch failed — use empty array
    }
    const targetIds = session.target_concepts || [];
    const concepts = await flaskGet<
      { id: string; label: string; description: string }[]
    >(`/api/concepts?ids=${targetIds.join(",")}`);

    const weakConcepts = (concepts || []).map((c) => {
      const m = masteryData.find(
        (md: { concept_id: string }) => md.concept_id === c.id
      );
      return {
        label: c.label,
        description: c.description || "",
        confidence: m?.confidence || 0,
      };
    });
    systemPrompt = buildTutoringSystemPrompt(
      "CS229 Machine Learning",
      weakConcepts,
      []
    );
  }

  // 4. Call Claude Sonnet with full history
  const aiMessage = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: systemPrompt,
    messages: conversationHistory,
  }, { timeout: 15000 });

  const assistantContent =
    aiMessage.content[0].type === "text"
      ? aiMessage.content[0].text
      : "Could you tell me more about what you understand so far?";

  // 5. Store assistant response
  const storedMessages = await flaskPost<{ id: string }[]>(
    `/api/tutoring/sessions/${sessionId}/messages`,
    { role: "assistant", content: assistantContent }
  );
  const storedMessage = Array.isArray(storedMessages) ? storedMessages[0] : storedMessages;

  // 6. Understanding check (Haiku sidecar)
  const targetConceptIds = session.target_concepts || [];
  const targetConcepts = await flaskGet<
    { id: string; label: string; description: string }[]
  >(`/api/concepts?ids=${targetConceptIds.join(",")}`);

  const masteryUpdates: {
    conceptId: string;
    conceptLabel: string;
    oldColor: string;
    newColor: string;
    confidence: number;
  }[] = [];

  if (targetConcepts && targetConcepts.length > 0) {
    const check = await checkUnderstanding(
      content,
      targetConcepts.map((c) => ({
        label: c.label,
        description: c.description || "",
      }))
    );

    // 7. If understood, update mastery via Flask
    if (check.understood && check.concept_label) {
      const matchedConcept = targetConcepts.find(
        (c) => c.label.toLowerCase() === check.concept_label.toLowerCase()
      );

      if (matchedConcept) {
        try {
          const update = await flaskPut<{
            concept_id: string;
            old_color: string;
            new_color: string;
            confidence: number;
          }>(
            `/api/students/${session.student_id}/mastery/${matchedConcept.id}`,
            { delta: 0.2 }
          );

          masteryUpdates.push({
            conceptId: matchedConcept.id,
            conceptLabel: matchedConcept.label,
            oldColor: update.old_color,
            newColor: update.new_color,
            confidence: update.confidence,
          });

          // Set concept_id on the assistant message
          if (storedMessage?.id) {
            await flaskPut(
              `/api/tutoring/messages/${storedMessage.id}`,
              { concept_id: matchedConcept.id }
            );
          }

          // Emit mastery:updated via Socket.IO
          emitToStudent(session.student_id, "mastery:updated", {
            studentId: session.student_id,
            conceptId: matchedConcept.id,
            oldColor: update.old_color,
            newColor: update.new_color,
            confidence: update.confidence,
          });
        } catch (e) {
          console.error("Failed to update mastery from tutoring:", e);
        }
      }
    }
  }

  return NextResponse.json({
    message: { role: "assistant", content: assistantContent },
    masteryUpdates: masteryUpdates.length > 0 ? masteryUpdates : undefined,
  });
}
