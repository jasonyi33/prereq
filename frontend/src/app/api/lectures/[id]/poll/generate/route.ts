import { NextRequest, NextResponse } from "next/server";
import { generateQuestion } from "@/lib/prompts/question-generation";
import { getConceptMap } from "@/lib/concept-cache";
import { flaskGet, flaskPost } from "@/lib/flask";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;
  const body = await request.json();
  let { conceptId } = body as { conceptId?: string };

  // Fetch concept map (cached — avoids redundant lecture + graph fetches)
  let conceptMap;
  try {
    conceptMap = await getConceptMap(lectureId);
  } catch {
    return NextResponse.json(
      { error: "Lecture or course graph not found" },
      { status: 404 }
    );
  }

  const { nodes } = conceptMap;

  // If no conceptId provided, use the most recently detected concept
  if (!conceptId) {
    try {
      const recent = await flaskGet<{ concept_id: string }>(
        `/api/lectures/${lectureId}/recent-concept`
      );
      conceptId = recent.concept_id;
    } catch {
      if (nodes.length === 0) {
        return NextResponse.json(
          { error: "No concepts available in this course" },
          { status: 400 }
        );
      }
      conceptId = nodes[Math.floor(Math.random() * nodes.length)].id;
    }
  }

  const concept = nodes.find((n) => n.id === conceptId);

  if (!concept) {
    return NextResponse.json(
      { error: "Concept not found" },
      { status: 404 }
    );
  }

  try {
    // Fetch transcript chunks and generate question in parallel
    let recentTranscript = "";
    const transcriptPromise = flaskGet<{ text: string; timestamp_sec: number }[]>(
      `/api/lectures/${lectureId}/transcript-chunks?limit=5`
    ).then((chunks) =>
      (chunks || []).reverse().map((c) => c.text).join(" ")
    ).catch(() => "");

    recentTranscript = await transcriptPromise;

    // Generate the question via Claude Sonnet
    const { question, expectedAnswer } = await generateQuestion(
      concept.label,
      concept.description || "",
      recentTranscript
    );

    // Insert poll_questions row via Flask
    const poll = await flaskPost<{ id: string }>(
      "/api/polls",
      {
        lecture_id: lectureId,
        concept_id: conceptId,
        question,
        expected_answer: expectedAnswer,
        status: "draft",
      }
    );

    return NextResponse.json({
      pollId: poll.id,
      question,
      expectedAnswer,
      conceptId,
      conceptLabel: concept.label,
    });
  } catch (err) {
    console.error("Poll generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate question. Please try again." },
      { status: 500 }
    );
  }
}
