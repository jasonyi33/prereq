import { NextRequest, NextResponse } from "next/server";
import { flaskPost } from "@/lib/flask";
import { detectConcepts } from "@/lib/prompts/concept-detection";
import { getConceptMap } from "@/lib/concept-cache";
import { getStudentsInLecture } from "@server/socket-helpers";

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

  // Socket.IO events are emitted by rtms.ts (Express context) after this route responds.
  // Next.js API routes don't have access to the Socket.IO server instance.

  return NextResponse.json({
    chunkId: chunk.id,
    detectedConcepts,
  });
}
