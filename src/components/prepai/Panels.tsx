import type { Round } from "@/lib/fixtures";

// Skill bars (weakest-first) live in charts/bklit/SkillBars.tsx; the skill
// radar in charts/bklit/SkillRadar.tsx.

// ── Slow-signals card — measured, coaching language, never a grade ────────────
// These are the habits we watch but don't plot as skill curves (they're
// sawtooth within 20 min): eye contact, posture, filler, pace, plus technical
// correctness which can't be coached in-round.

export function DeliveryCard({ delivery }: { delivery: Round["delivery"] }) {
  const eye = Math.round(delivery.eye_contact * 100);
  const posture = Math.round(delivery.posture * 100);
  const technical = Math.round(delivery.technical_correctness * 100);
  const lines = [
    {
      label: "Eye contact",
      note:
        eye >= 60
          ? `You held eye contact ${eye}% of the time — right where you want it.`
          : `You held eye contact ${eye}% of the time — aim for 60%.`,
      good: eye >= 60,
    },
    {
      label: "Posture",
      note:
        posture >= 70
          ? `Open, steady posture ${posture}% of the round — keep it.`
          : `Posture stayed open ${posture}% of the round — sit tall through the harder questions.`,
      good: posture >= 70,
    },
    {
      label: "Filler words",
      note:
        delivery.filler_rate <= 4
          ? `About ${delivery.filler_rate}/min — crisp.`
          : `About ${delivery.filler_rate} fillers a minute — a beat of silence beats an "um".`,
      good: delivery.filler_rate <= 4,
    },
    {
      label: "Pace",
      note:
        delivery.pace_wpm >= 130 && delivery.pace_wpm <= 165
          ? `${delivery.pace_wpm} wpm — an easy pace to follow.`
          : delivery.pace_wpm > 165
            ? `${delivery.pace_wpm} wpm — slow down so every point lands.`
            : `${delivery.pace_wpm} wpm — you can pick up the pace a little.`,
      good: delivery.pace_wpm >= 130 && delivery.pace_wpm <= 165,
    },
    {
      label: "Technical correctness",
      note:
        technical >= 70
          ? `Content held up ${technical}% of the time — the fundamentals are there.`
          : `Content checked out ${technical}% of the time — shore up the fundamentals between rounds.`,
      good: technical >= 70,
    },
  ];

  return (
    <div className="space-y-3">
      {lines.map((l) => (
        <div key={l.label} className="flex gap-3">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.good ? "bg-success" : "bg-warning"}`}
          />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-faint">
              {l.label}
            </div>
            <div className="text-sm text-ink">{l.note}</div>
          </div>
        </div>
      ))}
      <p className="pt-1 text-xs text-faint">
        Measured, not coached in-round — and it stays private to you.
      </p>
    </div>
  );
}

// ── "What HPE asks" — ranked weight bars (brief §7.2 / §7.4) ──────────────────

export function WeightBars({
  weights,
  caption,
}: {
  weights: { label: string; weight: number }[];
  caption?: string;
}) {
  const sorted = [...weights].sort((a, b) => b.weight - a.weight);
  return (
    <div className="space-y-2.5">
      {sorted.map((w) => (
        <div key={w.label} className="flex items-center gap-3">
          <div className="w-64 shrink-0 text-sm text-ink">{w.label}</div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.round(w.weight * 100)}%` }}
            />
          </div>
          <div className="w-10 text-right text-xs font-medium tabular-nums text-muted">
            {Math.round(w.weight * 100)}%
          </div>
        </div>
      ))}
      {caption && <p className="pt-1 text-xs text-faint">{caption}</p>}
    </div>
  );
}
