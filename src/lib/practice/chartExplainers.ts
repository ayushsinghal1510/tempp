import type { InfoStep } from "@/components/practice/ChartInfoButton";

export const SESSIONS_CHART_STEPS: InfoStep[] = [
  {
    title: "Each point is a session",
    description:
      "S1, S2, S3... are your practice sessions in order, not calendar dates — so the line shows real progress from one attempt to the next.",
  },
  {
    title: "Switch what it shows",
    description:
      "Toggle between your overall score, a single topic's trend, all topics at once, or the net change session-over-session.",
  },
  {
    title: "Scale to fit",
    description:
      "Turn this on to zoom into your own range of scores — handy if your scores are close together and the fixed 0–10 scale makes the line look flat.",
  },
];

export const TURNS_TIMELINE_STEPS: InfoStep[] = [
  {
    title: "Each point is a turn",
    description:
      "This tracks all 6 topics turn by turn within this one session — how your scores moved as the conversation went on.",
  },
  {
    title: "Click a topic to isolate it",
    description:
      "Click a name in the legend below the chart to highlight just that line; click it again to show all 6 at once.",
  },
  {
    title: "Show kinks",
    description:
      "Turn this on to mark moments the coach flagged — a suggestion, an acknowledgment, or you adopting the feedback.",
  },
  {
    title: "Scale to fit",
    description:
      "Turn this on to zoom into your own range of scores instead of the fixed 0–10 axis.",
  },
];

export const RADAR_STEPS: InfoStep[] = [
  {
    title: "Six spokes, six topics",
    description:
      "Each spoke is one scored area: Posture, Framing, Approach, Numbers, Confidence, Example — the further out, the higher the score.",
  },
  {
    title: "Shape shows balance",
    description:
      "A lopsided shape means some areas are much stronger than others; a rounder shape means you're consistent across the board.",
  },
  {
    title: "Scale to fit",
    description:
      "Turn this on to stretch small scores to fill the chart — otherwise low scores near the center can look like a single dot.",
  },
];

export const BARS_STEPS: InfoStep[] = [
  {
    title: "Sorted weakest first",
    description:
      "Bars are ordered lowest to highest score, so the highlighted bar at the top is exactly what to practice next.",
  },
  {
    title: "Hover for the exact score",
    description:
      "Each bar shows a qualitative label by default — hover any bar to see the precise 0–10 number behind it.",
  },
];
