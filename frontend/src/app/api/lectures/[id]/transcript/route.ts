import { NextRequest, NextResponse } from "next/server";
import { flaskGet, flaskPost } from "@/lib/flask";
import { detectConcepts } from "@/lib/prompts/concept-detection";
import { emitToLectureRoom, getStudentsInLecture } from "@server/socket-helpers";

// Cache: lectureId → { labels: string[], labelToId: Map<string, string> }
const conceptCache = new Map<string, { labels: string[]; labelToId: Map<string, string> }>();

interface LectureData {
  id: string;
  course_id: string;
  title: string;
  status: string;
}

interface GraphNode {
  id: string;
  label: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: unknown[];
}

interface TranscriptChunk {
  id: string;
  lecture_id: string;
  text: string;
  timestamp_sec: number;
  speaker_name: string | null;
}

async function getConceptMap(lectureId: string): Promise<{ labels: string[]; labelToId: Map<string, string> }> {
  if (conceptCache.has(lectureId)) {
    return conceptCache.get(lectureId)!;
  }

  // Look up course_id for this lecture via Flask
  const lecture = await flaskGet<LectureData>(`/api/lectures/${lectureId}`);

  // Fetch concepts from Flask
  const graph = await flaskGet<GraphData>(`/api/courses/${lecture.course_id}/graph`);

  const labelToId = new Map<string, string>();
  const labels: string[] = [];
  for (const node of graph.nodes || []) {
    labels.push(node.label);
    labelToId.set(node.label, node.id);
  }

  const cached = { labels, labelToId };
  if (labels.length > 0) {
    conceptCache.set(lectureId, cached);
  }
  return cached;
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

  // Step 4: Call Flask attendance-boost (skip if no concepts detected)
  if (detectedConcepts.length > 0) {
    const studentIds = getStudentsInLecture(lectureId);
    if (studentIds.length > 0) {
      try {
        await flaskPost("/api/mastery/attendance-boost", {
          concept_ids: detectedConcepts.map((c) => c.id),
          student_ids: studentIds,
        });
      } catch {
        // Flask endpoint may not exist yet — silently skip
      }
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
