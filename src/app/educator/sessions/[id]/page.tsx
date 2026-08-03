import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { roundVisibilityForEducator } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import {
  TYPE_BADGE,
  TYPE_LABEL,
  type TopicDict,
} from "@/lib/practice/topics";
import { sessionDurationSeconds, topicLabel } from "@/lib/practice/metrics";
import { tenantConfig } from "@/lib/tenants/config";
import { clinicalRoundMetrics } from "@/lib/practice/clinicalMetrics";
import ClinicalMetricsPanel from "@/components/practice/ClinicalMetricsPanel";
import TopicRadar from "@/components/charts/bklit/TopicRadar";

export const dynamic = "force-dynamic";

export default async function EducatorSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice_admin"], "/educator/login");
  const unitPlural = tenantConfig(user.tenant).copy.unitPlural;
  const { topics, track, copy } = tenantConfig(user.tenant);

  // The single choke point for the drill/assessment split. Decided here,
  // before any turn content is read — not hidden in the markup below.
  const visibility = await roundVisibilityForEducator(user.id, id);
  if (!visibility.analytics) notFound();

  const round = await prisma.practiceRound.findUnique({
    where: { id },
    include: {
      turns: { orderBy: { turnNumber: "asc" } },
      company: { select: { id: true, companyName: true } },
      user: { select: { id: true, name: true } },
    },
  });
  if (!round) notFound();

  const lastTurn = round.turns[round.turns.length - 1];
  const latestScores = topics.map((t) => {
    const dict = (lastTurn?.topics as Record<string, TopicDict> | null)?.[t.key];
    return typeof dict?.score === "number" ? dict.score : 0;
  });
  const hasScores = round.turns.some((t) => t.topics != null);

  const duration = sessionDurationSeconds(round);

  // Word counts are analytics, so they sit above the visibility line with the
  // scores. The individual jargon TERMS are transcript content and are gated
  // on visibility.content below — same choke point as the transcript itself.
  const clinical =
    track === "clinical" ? clinicalRoundMetrics(round.turns) : null;

  return (
    <DashboardShell
      user={user}
      nav={educatorNav(unitPlural)}
      title={`${round.user.name} — session`}
    >
      <div className="space-y-6">
        <Link
          href={`/educator/students/${round.user.id}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← {round.user.name}
        </Link>

        <section className="card p-6">
          <h2 className="text-xl font-bold text-ink">
            {round.company?.companyName ?? "Practice session"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {round.status === "completed" ? "Completed" : "In progress"} ·{" "}
            {round.turns.length} turn{round.turns.length === 1 ? "" : "s"}
            {duration != null &&
              ` · ${Math.floor(duration / 60)}m ${duration % 60}s`}
          </p>
        </section>

        {hasScores && (
          <section className="card p-6">
            <h3 className="font-semibold text-ink">Where they finished</h3>
            <div className="mt-4 max-w-md">
              <TopicRadar
                axes={topics.map((t) => t.label)}
                series={[
                  {
                    label: "Latest",
                    color: "var(--brand)",
                    values: latestScores,
                  },
                ]}
                max={10}
              />
            </div>
          </section>
        )}

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Coaching moments</h3>
          <p className="mt-0.5 text-sm text-muted">
            Every turn where the coach flagged something, and how the student
            responded.
          </p>
          <div className="mt-4 space-y-3">
            {round.turns
              .map((turn) => {
                const topics =
                  (turn.topics as Record<string, TopicDict> | null) ?? {};
                const kinks = Object.entries(topics).filter(
                  ([, d]) => d.type_,
                );
                return { turn, kinks };
              })
              .filter(({ kinks }) => kinks.length > 0)
              .map(({ turn, kinks }) => (
                <div
                  key={turn.id}
                  className="rounded-lg border border-line p-4"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-faint">
                    Turn {turn.turnNumber}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {kinks.map(([key, dict]) => (
                      <span
                        key={key}
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          TYPE_BADGE[dict.type_ as string] ??
                          "bg-canvas text-muted"
                        }`}
                      >
                        {topicLabel(key, topics)} ·{" "}
                        {TYPE_LABEL[dict.type_ as string] ?? dict.type_}
                        {typeof dict.score === "number" &&
                          ` ${dict.score.toFixed(1)}`}
                      </span>
                    ))}
                  </div>
                  {kinks.some(([, d]) => d.description) && (
                    <ul className="mt-2 space-y-1 text-sm text-ink">
                      {kinks
                        .filter(([, d]) => d.description)
                        .map(([key, d]) => (
                          <li key={key}>{d.description}</li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            {!hasScores && (
              <p className="text-sm text-muted">
                No scored turns in this session yet.
              </p>
            )}
          </div>
        </section>

        {clinical && (
          <section className="card p-6">
            <h3 className="font-semibold text-ink">Counted, not judged</h3>
            <p className="mt-0.5 text-xs text-muted">
              Straight off the transcript — the same numbers every time, with no
              model making a call about them.
            </p>
            <div className="mt-5">
              <ClinicalMetricsPanel
                metrics={clinical}
                showTerms={visibility.content}
              />
            </div>
          </section>
        )}

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Transcript</h3>
          {visibility.content ? (
            round.turns.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {round.turns.map((turn) => (
                  <div
                    key={turn.id}
                    className="rounded-lg border border-line p-4"
                  >
                    <div className="text-xs font-medium uppercase tracking-wide text-faint">
                      Turn {turn.turnNumber}
                    </div>
                    {turn.transcript && (
                      <p className="mt-1 text-sm text-ink">
                        <span className="text-muted">
                          {round.user.name}:{" "}
                        </span>
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
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="mt-2 rounded-lg border border-line bg-canvas p-4 text-sm text-muted">
              This was a <strong className="text-ink">private drill</strong>.
              You see the scores and coaching moments above, but not the
              transcript or the recording — that&apos;s what makes students
              willing to be bad at it in here. Assign this company as a{" "}
              <em>graded assessment</em> if you need the full record.
            </p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
