export const COLOR_HEX: Record<string, string> = {
  gray: "#94a3b8",
  red: "#ef4444",
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
