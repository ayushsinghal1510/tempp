// Turns the same numbers already computed by aggregate() into a plain-language
// sentence and qualitative labels, so students get a takeaway without having
// to read charts at all.
import { topicLabel } from "./metrics";

export function qualitativeLabel(score: number): string {
  if (score >= 8) return "Strong";
  if (score >= 6) return "Good";
  if (score >= 4) return "Improving";
  return "Needs work";
}

export function qualitativeTrend(avgImprovement: number | null): string {
  if (avgImprovement == null) return "Not enough data";
  if (avgImprovement > 0.3) return "Improving";
  if (avgImprovement < -0.3) return "Declining";
  return "Steady";
}

export function summarizeStats({
  totalSessions,
  bestTopic,
  worstTopic,
  avgImprovement,
}: {
  totalSessions: number;
  bestTopic: string | null;
  worstTopic: string | null;
  avgImprovement: number | null;
}): string {
  if (totalSessions === 0) {
    return "Run your first practice session to see insights here.";
  }

  const best = bestTopic ? topicLabel(bestTopic) : null;
  const worst = worstTopic ? topicLabel(worstTopic) : null;
  const trend =
    avgImprovement == null
      ? ""
      : avgImprovement > 0.3
        ? " and you're improving session over session"
        : avgImprovement < -0.3
          ? ", though your recent scores have dipped a bit"
          : "";

  if (best && worst && best !== worst) {
    return `Your strongest area is ${best}${trend} — focus on ${worst} next.`;
  }
  if (best) {
    return `Your strongest area is ${best}${trend}.`;
  }
  return "Keep practicing to build up your topic scores.";
}
