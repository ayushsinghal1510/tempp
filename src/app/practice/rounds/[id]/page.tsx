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
import { resolveRecording } from "@/lib/practice/recordingStorage";
import {
  TYPE_BADGE,
  TYPE_COLOR,
  TYPE_LABEL,
  type TopicDict,
} from "@/lib/practice/topics";
import { bestWorstTopic, sessionImprovement } from "@/lib/practice/metrics";
import { tenantConfig } from "@/lib/tenants/config";
import { clinicalRoundMetrics } from "@/lib/practice/clinicalMetrics";
import ClinicalMetricsPanel from "@/components/practice/ClinicalMetricsPanel";
import DebriefPanel from "@/components/practice/DebriefPanel";
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
  const { topics, track, features, copy } = tenantConfig(user.tenant);

  const round = await getRoundWithTurns(id);
  if (!round || round.userId !== user.id) notFound();

  // "Acme — ML Engineer", or just "Acme" when there is no role on the row.
  // Null when this was a general practice round with no company at all, which
  // is a real state on jer and not a missing value.
  const companyName = round.company?.companyName ?? round.companyName ?? null;
  const jobTitle = round.company?.jobTitle ?? round.jobTitle ?? null;
  const companyLabel = companyName
    ? jobTitle
      ? `${companyName} — ${jobTitle}`
      : companyName
    : null;

  const series = topics.map((t) => ({
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
  const latestScores = topics.map((t) => {
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
          values: topics.map(() => 0),
        },
        { label: "Latest", color: "var(--brand)", values: latestScores },
      ]
    : [];

  const roundBestWorst = hasScores ? bestWorstTopic(round, topics) : null;
  const headline = summarizeStats(
    {
      totalSessions: hasScores ? 1 : 0,
      bestTopic: roundBestWorst?.best ?? null,
      worstTopic: roundBestWorst?.worst ?? null,
      avgImprovement: hasScores ? sessionImprovement(round, topics) : null,
    },
    topics,
  );

  // Counted, not judged — see clinicalMetrics.ts. getRoundWithTurns already
  // pulls full turn rows, so this costs no extra query.
  const clinical =
    track === "clinical" ? clinicalRoundMetrics(round.turns) : null;

  const weakestFirst = topics.map((t, i) => ({
    label: t.label,
    value: latestScores[i],
  }))
    .sort((a, b) => a.value - b.value)
    .map((item, i) => ({ ...item, highlight: i === 0 }));

  // A kink only exists where the model actually flagged one of the 4 events
  // (type_ non-empty) for that topic on that turn — most turns have none.
  const kinks: TopicKink[] = [];
  topics.forEach((t) => {
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
  // Not a bare file check any more: the student is released from the call
  // before their recording finishes uploading, so "no file yet" and "there
  // will never be a file" are different answers and read differently below.
  const recording = await resolveRecording(
    id,
    round.recordingStatus,
    round.completedAt,
  );

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} tenant={user.tenant} />
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
            {track === "clinical"
              ? "Patient encounter results"
              : features.scoring
                ? "Practice interview results"
                : "Session"}
          </h1>
          {/* Which one this was. The page title is the same on every session a
              student has ever run, so without this a results page four rounds
              deep is unidentifiable. Relation first, then the legacy
              denormalized column for rounds that predate PracticeCompany;
              a general practice round has neither and simply says so. */}
          <p className="mt-1 text-base font-medium text-ink">
            {companyLabel ?? "General practice — no specific company"}
          </p>
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
              {features.scoring
                ? `Your ${topics.length} topics over the round`
                : "Recording"}
            </h3>
            {features.scoring && hasScores && (
              <ChartInfoButton
                chartTitle={`Your ${topics.length} topics over the round`}
                steps={TURNS_TIMELINE_STEPS}
              />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {features.scoring
              ? `${topics.map((t) => t.label).join(", ")} — scored 0–10, turn by turn.`
              : "The video of this session, kept for you to play back."}
          </p>
          {/* Rendered even with no scored turns: this is where the "analysing
              your video" notice lives, and a student who walks straight here
              from the call is exactly the person who needs to see it. The
              chart inside handles the empty and single-turn cases itself. */}
          <div className="mt-4">
            <RoundResultsRecording
              roundId={id}
              recordingState={recording.state}
              series={series}
              kinks={kinks}
              turnSeconds={turnSeconds}
              fallbackDurationSec={fallbackDurationSec}
              max={10}
              showTimeline={features.scoring}
            />
          </div>
        </section>

        {/* Above the transcript and above the recording's siblings: on the
            roleplay track this is the result, and the transcript below it is
            the evidence. Gated on the feature rather than on the columns being
            non-null so it stays inert for every other tenant, none of which
            ever writes them. */}
        {features.roleplay && (
          <DebriefPanel
            agentNoun={copy.agentNoun}
            score={round.overallScore}
            total={round.debriefTotal}
            outcome={round.outcome}
            feedback={round.debriefFeedback}
            summary={round.debriefSummary}
          />
        )}

        {clinical && (
          <section className="card p-6">
            <h3 className="font-semibold text-ink">Counted, not judged</h3>
            <p className="mt-0.5 text-xs text-muted">
              Straight off the transcript — the same numbers every time, with no
              model making a call about them.
            </p>
            <div className="mt-5">
              <ClinicalMetricsPanel metrics={clinical} />
            </div>
          </section>
        )}

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
                  axes={topics.map((t) => t.label)}
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
          <h3 className="font-semibold text-ink">
            {features.scoring ? "Turn by turn" : "Transcript"}
          </h3>
          {round.turns.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {round.turns.map((turn) => {
                // Named to distinguish it from `topics`, the rubric — this is
                // this one turn's scores, keyed by topic.
                const turnTopics =
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
                        <span className="text-muted">
                          {copy.agentNoun}:{" "}
                        </span>
                        {turn.speak}
                      </p>
                    )}
                    {/* The reason a score moved, shown rather than hidden.
                        `description` used to live only in a `title` tooltip,
                        which meant the one field that explains the number was
                        invisible on touch and undiscoverable everywhere else —
                        the student saw a topic and a figure and had to take
                        both on faith. It is by construction a record of what
                        the agent said out loud, so showing it costs nothing
                        and turns the badge row into the actual explanation. */}
                    {Object.entries(turnTopics).some(([, dict]) => dict.type_) && (
                      <div className="mt-3 flex flex-col gap-2">
                        {Object.entries(turnTopics)
                          .filter(([, dict]) => dict.type_)
                          .map(([key, dict]) => {
                            const label =
                              topics.find((t) => t.key === key)?.label ?? key;
                            const badge =
                              TYPE_BADGE[dict.type_ as string] ??
                              "bg-canvas text-muted";
                            const description = dict.description?.trim();
                            return (
                              <div
                                key={key}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                              >
                                <span
                                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge}`}
                                >
                                  {label}{" "}
                                  {typeof dict.score === "number"
                                    ? dict.score.toFixed(1)
                                    : "—"}
                                </span>
                                {/* Absent on plenty of real kinks, so it is
                                    conditional rather than an empty line. */}
                                {description && (
                                  <span className="text-xs text-muted">
                                    {description}
                                  </span>
                                )}
                              </div>
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
