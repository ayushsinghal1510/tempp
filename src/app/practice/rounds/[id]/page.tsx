import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getRoundWithTurns } from "@/lib/practice/cachedQueries";
import PracticeHeader from "@/components/practice/PracticeHeader";
import ChartInfoButton from "@/components/practice/ChartInfoButton";
import RoundResultsRecording from "@/components/practice/RoundResultsRecording";
import { type TopicKink } from "@/components/charts/bklit/TopicsTimeline";
import TopicRadar from "@/components/charts/bklit/TopicRadar";
import TopicBars from "@/components/charts/bklit/TopicBars";
import { findRecording } from "@/lib/practice/recordingStorage";
import {
  TOPIC_META,
  TYPE_BADGE,
  TYPE_COLOR,
  TYPE_LABEL,
  type TopicDict,
} from "@/lib/practice/topics";
import { bestWorstTopic, sessionImprovement } from "@/lib/practice/metrics";
import { summarizeStats } from "@/lib/practice/summarize";
import {
  TURNS_TIMELINE_STEPS,
  RADAR_STEPS,
  BARS_STEPS,
} from "@/lib/practice/chartExplainers";

export const dynamic = "force-dynamic";

export default async function PracticeRoundResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice"], "/practice/login");

  const round = await getRoundWithTurns(id);
  if (!round || round.userId !== user.id) notFound();

  const series = TOPIC_META.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    values: round.turns.map((turn) => {
      const dict = (turn.topics as Record<string, TopicDict> | null)?.[t.key];
      return typeof dict?.score === "number" ? dict.score : 0;
    }),
  }));
  const hasScores = round.turns.some((t) => t.topics != null);

  // Latest score per topic (the most recent turn carries every topic's
  // current score, kink or not) — powers the radar and the weakest-first bars.
  const lastTurn = round.turns[round.turns.length - 1];
  const latestScores = TOPIC_META.map((t) => {
    const dict = (lastTurn?.topics as Record<string, TopicDict> | null)?.[
      t.key
    ];
    return typeof dict?.score === "number" ? dict.score : 0;
  });

  const radarSeries = hasScores
    ? [
        {
          label: "Start",
          color: "var(--faint)",
          values: TOPIC_META.map(() => 0),
        },
        { label: "Latest", color: "var(--brand)", values: latestScores },
      ]
    : [];

  const roundBestWorst = hasScores ? bestWorstTopic(round) : null;
  const headline = summarizeStats({
    totalSessions: hasScores ? 1 : 0,
    bestTopic: roundBestWorst?.best ?? null,
    worstTopic: roundBestWorst?.worst ?? null,
    avgImprovement: hasScores ? sessionImprovement(round) : null,
  });

  const weakestFirst = TOPIC_META.map((t, i) => ({
    label: t.label,
    value: latestScores[i],
  }))
    .sort((a, b) => a.value - b.value)
    .map((item, i) => ({ ...item, highlight: i === 0 }));

  // A kink only exists where the model actually flagged one of the 4 events
  // (type_ non-empty) for that topic on that turn — most turns have none.
  const kinks: TopicKink[] = [];
  TOPIC_META.forEach((t) => {
    round.turns.forEach((turn, index) => {
      const dict = (turn.topics as Record<string, TopicDict> | null)?.[t.key];
      if (dict?.type_) {
        kinks.push({
          seriesKey: t.key,
          index,
          color: TYPE_COLOR[dict.type_] ?? "var(--faint)",
          label: TYPE_LABEL[dict.type_] ?? dict.type_,
          description: dict.description,
        });
      }
    });
  });

  const turnBase = new Date(
    round.startedAt ?? round.turns[0]?.timestamp ?? new Date(),
  ).getTime();
  const turnSeconds = round.turns.map((turn) => {
    const t = (new Date(turn.timestamp).getTime() - turnBase) / 1000;
    return Number.isFinite(t) ? Math.max(0, t) : 0;
  });
  const maxTurnSec = turnSeconds.length ? Math.max(...turnSeconds) : 0;
  // Never 0/NaN — a single-turn round (or one missing startedAt/completedAt)
  // would otherwise divide-by-zero downstream into NaN positions and labels.
  const fallbackDurationSec = Math.max(
    round.completedAt && round.startedAt
      ? (new Date(round.completedAt).getTime() -
          new Date(round.startedAt).getTime()) /
        1000
      : 0,
    maxTurnSec,
    1,
  );
  const recording = await findRecording(id);

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} />
      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-10">
        <Link
          href={
            round.companyId
              ? `/practice/companies/${round.companyId}`
              : "/practice"
          }
          className="text-sm text-muted hover:text-ink"
        >
          ← Back
        </Link>

        <div className="card p-6">
          <h1 className="text-2xl font-bold text-ink">
            Practice interview results
          </h1>
          <p className="mt-1 text-sm text-muted">
            {round.status === "completed" ? "Completed" : "In progress"} ·{" "}
            {round.turns.length} turn{round.turns.length === 1 ? "" : "s"}{" "}
            captured
          </p>
        </div>

        {hasScores && (
          <div className="card p-5 text-sm font-medium text-ink">
            {headline}
          </div>
        )}

        <section className="card p-6">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-ink">
              Your 6 topics over the round
            </h3>
            {hasScores && (
              <ChartInfoButton
                chartTitle="Your 6 topics over the round"
                steps={TURNS_TIMELINE_STEPS}
              />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Posture, Framing, Approach, Numbers, Confidence, Example — scored
            0–10, turn by turn.
          </p>
          {hasScores ? (
            <div className="mt-4">
              <RoundResultsRecording
                roundId={id}
                hasRecording={recording !== null}
                series={series}
                kinks={kinks}
                turnSeconds={turnSeconds}
                fallbackDurationSec={fallbackDurationSec}
                max={10}
              />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              No scored turns yet — data lands here once the webhook receives
              real turns from the call.
            </p>
          )}
        </section>

        {hasScores && (
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="card p-6">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink">Start vs latest</h3>
                <ChartInfoButton chartTitle="Start vs latest" steps={RADAR_STEPS} />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Where you began this round vs where you are now.
              </p>
              <div className="mt-4">
                <TopicRadar
                  axes={TOPIC_META.map((t) => t.label)}
                  series={radarSeries}
                  max={10}
                />
              </div>
            </section>

            <section className="card p-6">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink">Weakest first</h3>
                <ChartInfoButton chartTitle="Weakest first" steps={BARS_STEPS} />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Your lowest-scoring topic right now — start there next round.
              </p>
              <div className="mt-6">
                <TopicBars items={weakestFirst} max={10} />
              </div>
            </section>
          </div>
        )}

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Turn by turn</h3>
          {round.turns.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {round.turns.map((turn) => {
                const topics =
                  (turn.topics as Record<string, TopicDict> | null) ?? {};
                return (
                  <div
                    key={turn.id}
                    className="rounded-lg border border-line p-4"
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-faint">
                      Turn {turn.turnNumber}
                    </div>
                    {turn.transcript && (
                      <p className="mt-1 text-sm text-ink">
                        <span className="text-muted">You: </span>
                        {turn.transcript}
                      </p>
                    )}
                    {turn.speak && (
                      <p className="mt-1 text-sm text-ink">
                        <span className="text-muted">Coach: </span>
                        {turn.speak}
                      </p>
                    )}
                    {Object.entries(topics).some(([, dict]) => dict.type_) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(topics)
                          .filter(([, dict]) => dict.type_)
                          .map(([key, dict]) => {
                            const label =
                              TOPIC_META.find((t) => t.key === key)?.label ??
                              key;
                            const badge =
                              TYPE_BADGE[dict.type_ as string] ??
                              "bg-canvas text-muted";
                            return (
                              <span
                                key={key}
                                title={dict.description ?? ""}
                                className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge}`}
                              >
                                {label}{" "}
                                {typeof dict.score === "number"
                                  ? dict.score.toFixed(1)
                                  : "—"}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
