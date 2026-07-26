// Rubric-agnostic display metadata for the scoring system.
//
// The topic LIST itself no longer lives here — it varies by tenant (interview
// vs clinical) and is owned by src/lib/tenants/config.ts. Anything that needs
// the rubric takes it as a parameter or a prop, so a page can never render one
// tenant's data against another tenant's topics.
//
// What stays here is everything genuinely the same for both: the shape of a
// scored topic, and how the 4 kink types are labelled and coloured.

export type { TopicMeta } from "@/lib/tenants/config";

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
