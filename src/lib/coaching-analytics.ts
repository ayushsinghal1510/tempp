// ── Coaching-analytics data layer ───────────────────────────────────────────
// The per-interview skill graph: 5 lines (framing / ownership / quantification /
// concision / approach) over the fixed 20-minute session clock, on a 0–3 rubric.
// Vertical "kinks" mark the moments the agent intervened on a skill — those exist
// ONLY for coaching rounds (in a proctored test the agent never steps in, so no
// kinks). Values + kinks will come from the interview webhook later; for now we
// derive a plausible, per-round-varied sample from the authored fixture story.

import {
  roundReplay,
  type RoundReplay,
  type CoachEvent,
  type TimelinePoint,
} from "@/lib/fixtures";

// The fixtures author trajectories on a ~0–8 range; the coaching-analytics rubric
// is 0–3 (0 = absent, 3 = strong). Rescale onto it.
const RUBRIC_MAX = 3;
const SOURCE_MAX = 8;
const SCALE = RUBRIC_MAX / SOURCE_MAX;

export type AnalyticsKind = "coaching" | "test";

export type RoundAnalytics = Omit<RoundReplay, "kind"> & { kind: AnalyticsKind };

/** Deterministic 0..1 from a string, so each round varies but is stable. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const clampRubric = (v: number) =>
  Math.max(0, Math.min(RUBRIC_MAX, Math.round(v * 10) / 10));

/**
 * Build the analytics for one interview.
 * - `kind: "coaching"` → 5 lines + intervention kinks.
 * - `kind: "test"`     → 5 lines, NO kinks (the agent never intervenes).
 * The per-round jitter keeps sessions distinct so their averages are meaningful.
 */
export function buildRoundAnalytics(opts: {
  roundId: string;
  company: string;
  kind: AnalyticsKind;
  videoUrl?: string | null;
}): RoundAnalytics {
  const base = roundReplay(opts.roundId);
  const jitter = 0.85 + hash01(opts.roundId) * 0.3; // 0.85 .. 1.15
  const rescale = (v: number) => clampRubric(v * SCALE * jitter);

  const series: TimelinePoint[] = base.series.map((p) => {
    const row = { t: p.t } as TimelinePoint;
    for (const key of Object.keys(p)) {
      if (key !== "t") row[key] = rescale(p[key] as number);
    }
    return row;
  });

  const events: CoachEvent[] =
    opts.kind === "coaching"
      ? base.events.map((e) => ({
          ...e,
          from: e.from == null ? null : rescale(e.from),
          to: e.to == null ? null : rescale(e.to),
        }))
      : []; // test rounds carry no interventions → no kinks

  return {
    round_id: opts.roundId,
    company: opts.company,
    kind: opts.kind,
    duration: base.duration,
    video_url: opts.videoUrl || base.video_url,
    series,
    events,
  };
}

/**
 * Point-wise average of several interviews' 5 lines onto one graph (all sessions
 * are exactly 20 min, so they share the same t-grid). Averages never carry kinks.
 */
export function averageAnalytics(
  list: RoundAnalytics[],
  meta: { company: string; kind: AnalyticsKind },
): RoundAnalytics | null {
  if (list.length === 0) return null;
  const grid = list[0].series;
  const skillKeys = Object.keys(grid[0]).filter((k) => k !== "t");

  const series: TimelinePoint[] = grid.map((_, idx) => {
    const row = { t: grid[idx].t } as TimelinePoint;
    for (const key of skillKeys) {
      const sum = list.reduce(
        (acc, r) => acc + ((r.series[idx]?.[key] as number) ?? 0),
        0,
      );
      row[key] = Math.round((sum / list.length) * 10) / 10;
    }
    return row;
  });

  return {
    round_id: `avg-${meta.kind}`,
    company: meta.company,
    kind: meta.kind,
    duration: list[0].duration,
    video_url: "",
    series,
    events: [],
  };
}
