/**
 * Shared concept cache for lecture → concept label/ID mapping.
 * Uses in-memory L1 cache + Redis L2 cache (survives cold starts).
 * Used by transcript route and poll generation route to avoid redundant graph fetches.
 */

import { flaskGet } from "@/lib/flask";
import { cacheGet, cacheSet } from "@/lib/redis";

interface ConceptMap {
  labels: string[];
  labelToId: Map<string, string>;
  nodes: { id: string; label: string; description?: string }[];
  courseId: string;
  cachedAt: number;
}

// Serializable version for Redis (Map can't be JSON-serialized)
interface ConceptMapSerialized {
  labels: string[];
  labelToIdEntries: [string, string][];
  nodes: { id: string; label: string; description?: string }[];
  courseId: string;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const memCache = new Map<string, ConceptMap>();

interface LectureData {
  id: string;
  course_id: string;
  title: string;
  status: string;
}

interface GraphNode {
  id: string;
  label: string;
  description?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: unknown[];
}

function deserialize(s: ConceptMapSerialized): ConceptMap {
  return {
    labels: s.labels,
    labelToId: new Map(s.labelToIdEntries),
    nodes: s.nodes,
    courseId: s.courseId,
    cachedAt: Date.now(),
  };
}

export async function getConceptMap(lectureId: string): Promise<ConceptMap> {
  // L1: in-memory
  const existing = memCache.get(lectureId);
  if (existing && Date.now() - existing.cachedAt < TTL_MS) {
    return existing;
  }

  // L2: Redis
  const redisKey = `concept_map:${lectureId}`;
  const cached = await cacheGet<ConceptMapSerialized>(redisKey);
  if (cached) {
    const entry = deserialize(cached);
    memCache.set(lectureId, entry);
    return entry;
  }

  // Miss: fetch from Flask
  const lecture = await flaskGet<LectureData>(`/api/lectures/${lectureId}`);
  const graph = await flaskGet<GraphData>(`/api/courses/${lecture.course_id}/graph`);

  const labelToId = new Map<string, string>();
  const labels: string[] = [];
  const nodes: GraphNode[] = graph.nodes || [];

  for (const node of nodes) {
    labels.push(node.label);
    labelToId.set(node.label, node.id);
  }

  const entry: ConceptMap = {
    labels,
    labelToId,
    nodes,
    courseId: lecture.course_id,
    cachedAt: Date.now(),
  };

  if (labels.length > 0) {
    memCache.set(lectureId, entry);

    // Store in Redis (serializable form)
    const serialized: ConceptMapSerialized = {
      labels,
      labelToIdEntries: Array.from(labelToId.entries()),
      nodes,
      courseId: lecture.course_id,
    };
    await cacheSet(redisKey, serialized, 600); // 10 minutes
  }

  return entry;
}