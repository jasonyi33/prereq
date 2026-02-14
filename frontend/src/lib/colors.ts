export const COLOR_HEX: Record<string, string> = {
  gray: "#94a3b8",
  red: "#fb923c",       // orange-400 (matches heatmap struggling)
  yellow: "#eab308",
  green: "#22c55e",
  active: "#3b82f6",
};

export function confidenceToColor(confidence: number): string {
  if (confidence === 0) return "gray";
  if (confidence < 0.4) return "red";
  if (confidence < 0.7) return "yellow";
  return "green";
}

export function confidenceToFill(confidence: number): string {
  if (confidence === 0) return "#e2e8f0";     // slate-200 (unvisited)
  if (confidence < 0.2) return "#fecaca";     // red-200
  if (confidence < 0.4) return "#fed7aa";     // orange-200
  if (confidence < 0.55) return "#fef08a";    // yellow-200
  if (confidence < 0.7) return "#d9f99d";     // lime-200
  if (confidence < 0.85) return "#bbf7d0";    // green-200
  return "#86efac";                            // green-300
}

// 4-bucket node fill for the student knowledge graph (matches heatmap visual bands)
export function confidenceToNodeFill(confidence: number): string {
  if (confidence === 0) return "#e2e8f0";     // slate-200 (not started)
  if (confidence < 0.4) return "#fed7aa";     // orange-200 (struggling)
  if (confidence < 0.55) return "#fef08a";    // yellow-200 (partial)
  if (confidence < 0.7) return "#d9f99d";     // lime-200 (good)
  return "#bbf7d0";                            // green-200 (mastered)
}

// 4-bucket node border for the student knowledge graph
export function confidenceToNodeBorder(confidence: number): string {
  if (confidence === 0) return "#94a3b8";     // gray
  if (confidence < 0.4) return "#fb923c";     // orange-400 (struggling)
  if (confidence < 0.55) return "#facc15";    // yellow-400 (partial)
  if (confidence < 0.7) return "#a3e635";     // lime-400 (good)
  return "#4ade80";                            // green-400 (mastered)
}
