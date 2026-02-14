import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@server/db";
import { emitToLectureRoom, getStudentsInLecture } from "@server/socket-helpers";

// Stub until Person 3 merges detectConcepts from frontend/src/lib/prompts/concept-detection.ts
async function detectConcepts(text: string, labels: string[]): Promise<string[]> {
  return [];
}

// Cache: lectureId → { labels: string[], labelToId: Map<string, string> }
const conceptCache = new Map<string, { labels: string[]; labelToId: Map<string, string> }>();

async function getConceptMap(lectureId: string): Promise<{ labels: string[]; labelToId: Map<string, string> }> {
  if (conceptCache.has(lectureId)) {
    return conceptCache.get(lectureId)!;
  }

  // Look up course_id for this lecture
  const { data: lecture } = await supabase
    .from("lecture_sessions")
    .select("course_id")
    .eq("id", lectureId)
    .single();

  if (!lecture) {
    return { labels: [], labelToId: new Map() };
  }

  // Fetch concepts from Flask
  const flaskUrl = process.env.FLASK_API_URL || "http://localhost:5000";
  const res = await fetch(`${flaskUrl}/api/courses/${lecture.course_id}/graph`);
  const graph = await res.json();

  const labelToId = new Map<string, string>();
  const labels: string[] = [];
  for (const node of graph.nodes || []) {
    labels.push(node.label);
    labelToId.set(node.label, node.id);
  }

  const cached = { labels, labelToId };
  conceptCache.set(lectureId, cached);
  return cached;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;
  const { text, timestamp, speakerName } = await req.json();

  // Step 1: Insert transcript chunk
  const { data: chunk, error } = await supabase
    .from("transcript_chunks")
    .insert({
      lecture_id: lectureId,
      text,
      timestamp_sec: timestamp,
      speaker_name: speakerName || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Step 2: Detect concepts (stub returns [] until Person 3 merges)
  const { labels, labelToId } = await getConceptMap(lectureId);
  const detectedLabels = await detectConcepts(text, labels);

  // Step 3: Resolve labels to UUIDs, insert transcript_concepts
  const detectedConcepts: { id: string; label: string }[] = [];
  for (const label of detectedLabels) {
    const conceptId = labelToId.get(label);
    if (conceptId) {
      detectedConcepts.push({ id: conceptId, label });
      await supabase
        .from("transcript_concepts")
        .insert({ transcript_chunk_id: chunk.id, concept_id: conceptId });
    }
  }

  // Step 4: Call Flask attendance-boost (skip if no concepts detected)
  if (detectedConcepts.length > 0) {
    const studentIds = getStudentsInLecture(lectureId);
    if (studentIds.length > 0) {
      const flaskUrl = process.env.FLASK_API_URL || "http://localhost:5000";
      try {
        await fetch(`${flaskUrl}/api/mastery/attendance-boost`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concept_ids: detectedConcepts.map((c) => c.id),
            student_ids: studentIds,
          }),
        });
      } catch {
        // Flask endpoint may not exist yet — silently skip
      }
    }
  }

  // Step 5: Emit Socket.IO events
  emitToLectureRoom(lectureId, "transcript:chunk", {
    text,
    timestamp,
    detectedConcepts,
  });

  for (const concept of detectedConcepts) {
    emitToLectureRoom(lectureId, "lecture:concept-detected", {
      conceptId: concept.id,
      label: concept.label,
    });
  }

  return NextResponse.json({
    chunkId: chunk.id,
    detectedConcepts,
  });
}
