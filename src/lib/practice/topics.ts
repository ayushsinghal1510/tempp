// The 6-topic rubric's shared display metadata (key/label/color) — the single
// source every practice page reads from instead of redefining the same list.

export const TOPIC_META: { key: string; label: string; color: string }[] = [
  { key: "posture", label: "Posture", color: "var(--chart-1)" },
  { key: "framing", label: "Framing", color: "var(--chart-2)" },
  { key: "approach", label: "Approach", color: "var(--chart-3)" },
  { key: "numbers", label: "Numbers", color: "var(--chart-4)" },
  { key: "confidence", label: "Confidence", color: "var(--chart-5)" },
  { key: "example", label: "Example", color: "var(--brand)" },
];

export type TopicDict = {
  description?: string;
  score?: number;
  type_?: string;
};

export const TYPE_BADGE: Record<string, string> = {
  suggestion: "bg-warning-soft text-warning",
  acknowledged: "bg-success-soft text-success",
  adopted: "bg-success-soft text-success",
  repeated: "bg-danger-soft text-danger",
};

export const TYPE_COLOR: Record<string, string> = {
  suggestion: "var(--warning)",
  acknowledged: "var(--success)",
  adopted: "var(--success)",
  repeated: "var(--danger)",
};

export const TYPE_LABEL: Record<string, string> = {
  suggestion: "Suggested",
  acknowledged: "Acknowledged",
  adopted: "Adopted",
  repeated: "Repeated",
};
