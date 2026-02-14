import type { GraphEdge } from "@/components/graph/KnowledgeGraph";

/**
 * BFS backwards through prerequisite edges to find all ancestor nodes.
 * Edges go source (prereq) → target (dependent), so we follow edges
 * where target === current to find parents.
 *
 * Handles react-force-graph-2d edge mutation (source/target can be string or object).
 */
export function getAncestors(nodeId: string, edges: GraphEdge[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      const source = typeof edge.source === "object" ? (edge.source as { id: string }).id : edge.source;
      const target = typeof edge.target === "object" ? (edge.target as { id: string }).id : edge.target;
      if (target === current && !ancestors.has(source)) {
        ancestors.add(source);
        queue.push(source);
      }
    }
  }

  return ancestors;
}

/** Format seconds into MM:SS for transcript display */
export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
