import { NextRequest, NextResponse } from "next/server";
import { flaskPost } from "@/lib/flask";
import { detectConcepts } from "@/lib/prompts/concept-detection";
import { getConceptMap } from "@/lib/concept-cache";
import { emitToLectureRoom, getStudentsInLecture } from "@server/socket-helpers";

interface TranscriptChunk {
  id: string;
  lecture_id: string;
  text: string;
  timestamp_sec: number;
  speaker_name: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lectureId } = await params;
  const { text, timestamp, speakerName } = await req.json();

  // Step 1: Detect concepts using Claude Haiku
  const { labels, labelToId } = await getConceptMap(lectureId);
  const detectedLabels = await detectConcepts(text, labels);
  console.log(`[Concept Detection] "${text}" → detected: [${detectedLabels.join(", ")}] (from ${labels.length} known concepts)`);

  // Step 2: Resolve labels to UUIDs
  const detectedConcepts: { id: string; label: string }[] = [];
  for (const label of detectedLabels) {
    const conceptId = labelToId.get(label);
    if (conceptId) {
      detectedConcepts.push({ id: conceptId, label });
    }
  }

  // Step 3: Insert transcript chunk + link concepts via Flask (single call)
  const chunk = await flaskPost<TranscriptChunk>(
    `/api/lectures/${lectureId}/transcripts`,
    {
      text,
      timestamp_sec: timestamp,
      speaker_name: speakerName || null,
      concept_ids: detectedConcepts.map((c) => c.id),
    }
  );

  // Step 4: Fire-and-forget attendance-boost (non-blocking — no need to await)
  if (detectedConcepts.length > 0) {
    const studentIds = getStudentsInLecture(lectureId);
    if (studentIds.length > 0) {
      flaskPost("/api/mastery/attendance-boost", {
        concept_ids: detectedConcepts.map((c) => c.id),
        student_ids: studentIds,
      }).catch((err) =>
        console.warn("attendance-boost failed (non-critical):", err)
      );
    }
  }

  // Step 5: Emit Socket.IO events (may fail if called outside Express server context)
  try {
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
  } catch (err) {
    // Next.js API routes run in a separate context from the Express server,
    // so Socket.IO may not be available here. Events will still reach clients
    // if they poll or reconnect.
    console.warn("Socket emit skipped (not in Express server context)");
  }

  return NextResponse.json({
    chunkId: chunk.id,
    detectedConcepts,
  });
}
