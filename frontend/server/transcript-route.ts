/**
 * Express route for POST /api/lectures/:id/transcript
 *
 * Moved from Next.js API route to Express so Socket.IO emit works
 * (Next.js API routes run in a separate context where getIO() returns null).
 */

import { Router, json } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { emitToLectureRoom, getStudentsInLecture } from "./socket-helpers";

const router = Router();

// --- Flask helpers (inlined to avoid @/ alias issues) ---
// Read env lazily (static imports run before dotenv.config)
function getFlaskUrl(): string {
  return process.env.FLASK_API_URL || "http://localhost:5000";
}

async function flaskGet<T>(path: string): Promise<T> {
  console.log(`[transcript-route] Flask GET: ${getFlaskUrl()}${path}`);
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Flask GET ${path} failed: ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function flaskPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Flask POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// --- Concept detection (inlined from src/lib/prompts/concept-detection.ts) ---
// Lazy init: static imports run before dotenv.config loads ANTHROPIC_API_KEY
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

function buildConceptDetectionPrompt(chunk: string, labels: string[]): string {
  return `You are analyzing a live lecture transcript to detect which concepts are being taught.

KNOWN CONCEPTS FOR THIS COURSE:
${labels.map((l) => `- ${l}`).join("\n")}

TRANSCRIPT CHUNK:
"${chunk}"

TASK:
Identify which of the known concepts above are being actively discussed or taught in this transcript chunk.

RULES:
- Only return concepts that are clearly being explained or taught, not just briefly mentioned in passing.
- Return an empty array if no concepts are being discussed.
- Only use labels from the provided list — do not invent new ones.

Return ONLY valid JSON (no markdown, no explanation):
{ "detected_concepts": ["label1", "label2"] }`;
}

function parseConceptDetectionResponse(response: string): string[] {
  try {
    let cleaned = response.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    const parsed = JSON.parse(cleaned);
    if (parsed.detected_concepts && Array.isArray(parsed.detected_concepts)) {
      return parsed.detected_concepts;
    }
    return [];
  } catch {
    console.error("Failed to parse concept detection response:", response);
    return [];
  }
}

async function detectConcepts(text: string, labels: string[]): Promise<string[]> {
  if (labels.length === 0) return [];
  const prompt = buildConceptDetectionPrompt(text, labels);
  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  }, { timeout: 5000 });
  const content = message.content[0];
  if (content.type !== "text") return [];
  return parseConceptDetectionResponse(content.text);
}

// --- Concept map cache (simple in-memory, no Redis needed here) ---
interface ConceptMap {
  labels: string[];
  labelToId: Map<string, string>;
  cachedAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const conceptCache = new Map<string, ConceptMap>();

async function getConceptMap(lectureId: string): Promise<ConceptMap> {
  const existing = conceptCache.get(lectureId);
  if (existing && Date.now() - existing.cachedAt < TTL_MS) {
    return existing;
  }

  const lecture = await flaskGet<{ id: string; course_id: string }>(`/api/lectures/${lectureId}`);
  const graph = await flaskGet<{ nodes: { id: string; label: string }[] }>(`/api/courses/${lecture.course_id}/graph`);

  const labelToId = new Map<string, string>();
  const labels: string[] = [];
  for (const node of graph.nodes || []) {
    labels.push(node.label);
    labelToId.set(node.label, node.id);
  }

  const entry: ConceptMap = { labels, labelToId, cachedAt: Date.now() };
  if (labels.length > 0) conceptCache.set(lectureId, entry);
  return entry;
}

// --- Route handler ---
interface TranscriptChunk {
  id: string;
  lecture_id: string;
  text: string;
  timestamp_sec: number;
  speaker_name: string | null;
}

router.post("/api/lectures/:id/transcript", json(), async (req, res) => {
  try {
    const lectureId = req.params.id;
    const { text, timestamp, speakerName } = req.body;
    console.log(`[Express transcript-route] Processing chunk for lecture ${lectureId}`);

    // Step 1: Detect concepts using Claude Haiku
    const { labels, labelToId } = await getConceptMap(lectureId);
    const detectedLabels = await detectConcepts(text, labels);
    console.log(
      `[Concept Detection] "${text}" → detected: [${detectedLabels.join(", ")}] (from ${labels.length} known concepts)`
    );

    // Step 2: Resolve labels to UUIDs
    const detectedConcepts: { id: string; label: string }[] = [];
    for (const label of detectedLabels) {
      const conceptId = labelToId.get(label);
      if (conceptId) {
        detectedConcepts.push({ id: conceptId, label });
      }
    }

    // Step 3: Insert transcript chunk + link concepts via Flask
    const chunk = await flaskPost<TranscriptChunk>(
      `/api/lectures/${lectureId}/transcripts`,
      {
        text,
        timestamp_sec: timestamp,
        speaker_name: speakerName || null,
        concept_ids: detectedConcepts.map((c) => c.id),
      }
    );

    // Step 4: Fire-and-forget attendance-boost
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

    // Step 5: Emit Socket.IO events — this works because we're in the Express context!
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

    res.json({
      chunkId: chunk.id,
      detectedConcepts,
    });
  } catch (err) {
    console.error("[transcript-route] Error:", err);
    res.status(500).json({ error: "Failed to process transcript chunk" });
  }
});

export default router;
