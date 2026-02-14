import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";
import Anthropic from "@anthropic-ai/sdk";
import { buildTutoringSystemPrompt } from "@/lib/prompts/tutoring";
import { checkUnderstanding } from "@/lib/prompts/understanding-check";
import { emitToStudent } from "@server/socket-helpers";
import { confidenceToColor } from "@/lib/colors";

const FLASK_API_URL =
  process.env.FLASK_API_URL || "http://localhost:5000";
const anthropic = new Anthropic();

// GET: Fetch all messages for a tutoring session
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const { data: messages, error } = await supabase
    .from("tutoring_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .neq("role", "system") // Don't expose system prompt to client
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    messages: (messages || []).map(
      (m: { id: string; role: string; content: string; created_at: string }) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })
    ),
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
  const { data: session, error: sessionErr } = await supabase
    .from("tutoring_sessions")
    .select("student_id, target_concepts")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // 1. Insert the student's message
  await supabase.from("tutoring_messages").insert({
    session_id: sessionId,
    role: "user",
    content,
  });

  // 2. Load full conversation history
  const { data: allMessages } = await supabase
    .from("tutoring_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  // Separate system prompt from conversation
  const systemMessage = (allMessages || []).find(
    (m: { role: string }) => m.role === "system"
  );
  const conversationHistory = (allMessages || [])
    .filter((m: { role: string }) => m.role !== "system")
    .map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // 3. Rebuild system prompt if no stored one (fallback)
  let systemPrompt = systemMessage?.content || "";
  if (!systemPrompt) {
    // Fetch weak concepts and rebuild
    const masteryRes = await fetch(
      `${FLASK_API_URL}/api/students/${session.student_id}/mastery`
    );
    const masteryData = masteryRes.ok ? await masteryRes.json() : [];
    const targetIds = session.target_concepts || [];
    const { data: concepts } = await supabase
      .from("concept_nodes")
      .select("id, label, description")
      .in("id", targetIds);

    const weakConcepts = (concepts || []).map(
      (c: { id: string; label: string; description: string }) => {
        const m = masteryData.find(
          (md: { concept_id: string }) => md.concept_id === c.id
        );
        return {
          label: c.label,
          description: c.description || "",
          confidence: m?.confidence || 0,
        };
      }
    );
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
  });

  const assistantContent =
    aiMessage.content[0].type === "text"
      ? aiMessage.content[0].text
      : "Could you tell me more about what you understand so far?";

  // 5. Store assistant response
  const { data: storedMessage } = await supabase
    .from("tutoring_messages")
    .insert({
      session_id: sessionId,
      role: "assistant",
      content: assistantContent,
    })
    .select("id")
    .single();

  // 6. Understanding check (Haiku sidecar)
  const targetConceptIds = session.target_concepts || [];
  const { data: targetConcepts } = await supabase
    .from("concept_nodes")
    .select("id, label, description")
    .in("id", targetConceptIds);

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
      targetConcepts.map((c: { label: string; description: string }) => ({
        label: c.label,
        description: c.description || "",
      }))
    );

    // 7. If understood, update mastery via Flask
    if (check.understood && check.concept_label) {
      const matchedConcept = targetConcepts.find(
        (c: { label: string }) =>
          c.label.toLowerCase() === check.concept_label.toLowerCase()
      );

      if (matchedConcept) {
        try {
          const masteryRes = await fetch(
            `${FLASK_API_URL}/api/students/${session.student_id}/mastery/${matchedConcept.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ delta: 0.2 }),
            }
          );

          if (masteryRes.ok) {
            const update = await masteryRes.json();
            masteryUpdates.push({
              conceptId: matchedConcept.id,
              conceptLabel: matchedConcept.label,
              oldColor: update.old_color,
              newColor: update.new_color,
              confidence: update.confidence,
            });

            // Set concept_id on the assistant message
            if (storedMessage) {
              await supabase
                .from("tutoring_messages")
                .update({ concept_id: matchedConcept.id })
                .eq("id", storedMessage.id);
            }

            // Emit mastery:updated via Socket.IO
            emitToStudent(session.student_id, "mastery:updated", {
              studentId: session.student_id,
              conceptId: matchedConcept.id,
              oldColor: update.old_color,
              newColor: update.new_color,
              confidence: update.confidence,
            });
          }
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
