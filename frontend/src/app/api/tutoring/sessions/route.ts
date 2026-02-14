import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";
import Anthropic from "@anthropic-ai/sdk";
import { buildTutoringSystemPrompt } from "@/lib/prompts/tutoring";
import { confidenceToColor } from "@/lib/colors";

const FLASK_API_URL =
  process.env.FLASK_API_URL || "http://localhost:5000";
const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const { studentId, lectureId } = (await request.json()) as {
    studentId: string;
    lectureId?: string;
  };

  if (!studentId) {
    return NextResponse.json(
      { error: "studentId is required" },
      { status: 400 }
    );
  }

  // Fetch student's mastery from Flask
  const masteryRes = await fetch(
    `${FLASK_API_URL}/api/students/${studentId}/mastery`
  );
  if (!masteryRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch student mastery" },
      { status: 500 }
    );
  }
  const masteryData = (await masteryRes.json()) as {
    concept_id: string;
    confidence: number;
    color: string;
  }[];

  // Filter for weak concepts (confidence < 0.7)
  const weakConceptIds = masteryData
    .filter((m) => m.confidence < 0.7 && m.confidence > 0)
    .sort((a, b) => a.confidence - b.confidence)
    .map((m) => m.concept_id);

  if (weakConceptIds.length === 0) {
    return NextResponse.json(
      { error: "No weak concepts found — student is doing great!" },
      { status: 400 }
    );
  }

  // Fetch concept details for weak concepts
  const { data: concepts } = await supabase
    .from("concept_nodes")
    .select("id, label, description")
    .in("id", weakConceptIds);

  const conceptMap = new Map(
    (concepts || []).map((c: { id: string; label: string; description: string }) => [c.id, c])
  );

  const weakConcepts = weakConceptIds
    .map((id) => {
      const concept = conceptMap.get(id);
      const mastery = masteryData.find((m) => m.concept_id === id);
      if (!concept || !mastery) return null;
      return {
        id,
        label: concept.label,
        description: concept.description || "",
        confidence: mastery.confidence,
        color: confidenceToColor(mastery.confidence),
      };
    })
    .filter(Boolean) as {
      id: string;
      label: string;
      description: string;
      confidence: number;
      color: string;
    }[];

  // Fetch transcript excerpts if lectureId provided
  let transcriptExcerpts: { text: string; timestampSec: number }[] = [];
  if (lectureId) {
    const { data: chunks } = await supabase
      .from("transcript_concepts")
      .select(
        "concept_id, transcript_chunks!inner(text, timestamp_sec)"
      )
      .in("concept_id", weakConceptIds)
      .limit(20);

    if (chunks) {
      transcriptExcerpts = chunks.map(
        (c: { transcript_chunks: { text: string; timestamp_sec: number } }) => ({
          text: c.transcript_chunks.text,
          timestampSec: c.transcript_chunks.timestamp_sec || 0,
        })
      );
    }
  }

  // Build system prompt and generate opening message
  const systemPrompt = buildTutoringSystemPrompt(
    "CS229 Machine Learning",
    weakConcepts,
    transcriptExcerpts
  );

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content:
          "Hi, I just finished the lecture and I'd like some help with the concepts I struggled with.",
      },
    ],
  });

  const openingContent =
    message.content[0].type === "text"
      ? message.content[0].text
      : "Let's work through the concepts you found challenging. Which one would you like to start with?";

  // Create tutoring session
  const { data: session, error: sessionErr } = await supabase
    .from("tutoring_sessions")
    .insert({
      student_id: studentId,
      target_concepts: weakConceptIds,
    })
    .select()
    .single();

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: "Failed to create tutoring session" },
      { status: 500 }
    );
  }

  // Store system prompt as system message, and opening as assistant message
  await supabase.from("tutoring_messages").insert([
    { session_id: session.id, role: "system", content: systemPrompt },
    {
      session_id: session.id,
      role: "user",
      content:
        "Hi, I just finished the lecture and I'd like some help with the concepts I struggled with.",
    },
    {
      session_id: session.id,
      role: "assistant",
      content: openingContent,
    },
  ]);

  return NextResponse.json({
    sessionId: session.id,
    targetConcepts: weakConcepts.map((c) => ({
      id: c.id,
      label: c.label,
      confidence: c.confidence,
      color: c.color,
    })),
    initialMessage: { role: "assistant", content: openingContent },
  });
}
