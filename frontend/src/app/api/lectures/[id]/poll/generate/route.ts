import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";
import { generateQuestion } from "@/lib/prompts/question-generation";

const FLASK_API_URL =
  process.env.FLASK_API_URL || "http://localhost:5000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;
  const body = await request.json();
  let { conceptId } = body as { conceptId?: string };

  // Get the lecture to find the course_id
  const { data: lecture, error: lectureErr } = await supabase
    .from("lecture_sessions")
    .select("course_id")
    .eq("id", lectureId)
    .single();

  if (lectureErr || !lecture) {
    return NextResponse.json(
      { error: "Lecture not found" },
      { status: 404 }
    );
  }

  // If no conceptId provided, use the most recently detected concept
  if (!conceptId) {
    const { data: recentConcept } = await supabase
      .from("transcript_concepts")
      .select(
        "concept_id, transcript_chunks!inner(lecture_id, created_at)"
      )
      .eq("transcript_chunks.lecture_id", lectureId)
      .order("transcript_chunks(created_at)", { ascending: false })
      .limit(1)
      .single();

    if (recentConcept) {
      conceptId = recentConcept.concept_id;
    } else {
      return NextResponse.json(
        { error: "No concepts detected yet in this lecture" },
        { status: 400 }
      );
    }
  }

  // Fetch concept details from Flask
  const graphRes = await fetch(
    `${FLASK_API_URL}/api/courses/${lecture.course_id}/graph`
  );
  const graph = await graphRes.json();
  const concept = graph.nodes?.find(
    (n: { id: string }) => n.id === conceptId
  );

  if (!concept) {
    return NextResponse.json(
      { error: "Concept not found" },
      { status: 404 }
    );
  }

  // Fetch last 5 transcript chunks for context
  const { data: chunks } = await supabase
    .from("transcript_chunks")
    .select("text")
    .eq("lecture_id", lectureId)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentTranscript = (chunks || [])
    .reverse()
    .map((c: { text: string }) => c.text)
    .join(" ");

  // Generate the question via Claude Sonnet
  const { question, expectedAnswer } = await generateQuestion(
    concept.label,
    concept.description || "",
    recentTranscript
  );

  // Insert poll_questions row
  const { data: poll, error: pollErr } = await supabase
    .from("poll_questions")
    .insert({
      lecture_id: lectureId,
      concept_id: conceptId,
      question,
      expected_answer: expectedAnswer,
      status: "draft",
    })
    .select()
    .single();

  if (pollErr) {
    return NextResponse.json(
      { error: "Failed to create poll" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    pollId: poll.id,
    question,
    expectedAnswer,
    conceptId,
    conceptLabel: concept.label,
  });
}
