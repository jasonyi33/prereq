import { NextRequest, NextResponse } from "next/server";
import { generateQuestion } from "@/lib/prompts/question-generation";
import { flaskGet, flaskPost } from "@/lib/flask";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;
  const body = await request.json();
  let { conceptId } = body as { conceptId?: string };

  // Get the lecture to find the course_id
  let lecture: { id: string; course_id: string; title: string; status: string };
  try {
    lecture = await flaskGet(`/api/lectures/${lectureId}`);
  } catch {
    return NextResponse.json(
      { error: "Lecture not found" },
      { status: 404 }
    );
  }

  // Fetch the course graph (needed for fallback and concept lookup)
  let graph: { nodes: { id: string; label: string; description?: string }[] };
  try {
    graph = await flaskGet(`/api/courses/${lecture.course_id}/graph`);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch course graph" },
      { status: 502 }
    );
  }

  // If no conceptId provided, use the most recently detected concept
  if (!conceptId) {
    try {
      const recent = await flaskGet<{ concept_id: string }>(
        `/api/lectures/${lectureId}/recent-concept`
      );
      conceptId = recent.concept_id;
    } catch {
      // Fallback: pick a random concept from the course graph
      const nodes = graph.nodes || [];
      if (nodes.length === 0) {
        return NextResponse.json(
          { error: "No concepts available in this course" },
          { status: 400 }
        );
      }
      conceptId = nodes[Math.floor(Math.random() * nodes.length)].id;
    }
  }

  const concept = graph.nodes?.find((n) => n.id === conceptId);

  if (!concept) {
    return NextResponse.json(
      { error: "Concept not found" },
      { status: 404 }
    );
  }

  try {
    // Fetch last 5 transcript chunks for context
    let recentTranscript = "";
    try {
      const chunks = await flaskGet<{ text: string; timestamp_sec: number }[]>(
        `/api/lectures/${lectureId}/transcript-chunks?limit=5`
      );
      recentTranscript = (chunks || [])
        .reverse()
        .map((c) => c.text)
        .join(" ");
    } catch {
      // No transcript yet — generate question without transcript context
    }

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
