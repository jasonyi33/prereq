import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildTutoringSystemPrompt } from "@/lib/prompts/tutoring";
import { confidenceToColor } from "@/lib/colors";
import { flaskGet, flaskPost } from "@/lib/flask";

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
  let masteryData: {
    concept_id: string;
    confidence: number;
    color: string;
  }[];
  try {
    masteryData = await flaskGet(`/api/students/${studentId}/mastery`);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch student mastery" },
      { status: 500 }
    );
  }

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

  // Fetch concept details for weak concepts via Flask
  const concepts = await flaskGet<
    { id: string; label: string; description: string }[]
  >(`/api/concepts?ids=${weakConceptIds.join(",")}`);

  const conceptMap = new Map(
    (concepts || []).map((c) => [c.id, c])
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
    const excerpts = await flaskGet<
      { text: string; timestamp_sec: number }[]
    >(
      `/api/lectures/${lectureId}/transcript-excerpts?concept_ids=${weakConceptIds.join(",")}`
    );

    if (excerpts) {
      transcriptExcerpts = excerpts.map((c) => ({
        text: c.text,
        timestampSec: c.timestamp_sec || 0,
      }));
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

  // Create tutoring session via Flask
  const session = await flaskPost<{ id: string }>(
    "/api/tutoring/sessions",
    {
      student_id: studentId,
      target_concepts: weakConceptIds,
    }
  );

  if (!session?.id) {
    return NextResponse.json(
      { error: "Failed to create tutoring session" },
      { status: 500 }
    );
  }

  // Store system prompt as system message, user greeting, and opening as assistant message
  await flaskPost(`/api/tutoring/sessions/${session.id}/messages`, {
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Hi, I just finished the lecture and I'd like some help with the concepts I struggled with.",
      },
      { role: "assistant", content: openingContent },
    ],
  });

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
