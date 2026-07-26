import KpiCard from "@/components/practice/KpiCard";
import TopicBars from "@/components/charts/bklit/TopicBars";
import TopicRadar from "@/components/charts/bklit/TopicRadar";
import SessionsChart from "@/components/charts/bklit/SessionsChart";
import FunnelBar from "@/components/educator/FunnelBar";
import type { TenantConfig } from "@/lib/tenants/config";
import {
  classWeakest,
  cohortProgress,
  cohortStats,
  type Funnel,
  type StudentRounds,
} from "@/lib/practice/educatorMetrics";

/**
 * The analytics block every educator layer shares: the whole org, one company,
 * one class. Each layer differs only in which set of students it hands in, so
 * keeping this in one component is what stops "average score" meaning three
 * subtly different things depending on which page you're standing on.
 *
 * Rendered on the server; only the leaf charts are client components.
 */
export default function CohortAnalytics({
  students,
  funnel,
  scope,
  tenant,
  extraKpis,
}: {
  students: StudentRounds[];
  funnel: Funnel;
  /** Names the population in the copy — "this class", "this company". */
  scope: string;
  /** Supplies the rubric these students were scored against, plus the nouns. */
  tenant: TenantConfig;
  /** Layer-specific cards prepended to the row (student count, quota, …). */
  extraKpis?: React.ReactNode;
}) {
  const { topics, features, copy } = tenant;
  const stats = cohortStats(students, topics);
  const { perTopic, contributing } = classWeakest(students, topics);
  const progress = cohortProgress(students, topics);

  const barItems = topics.map((t, i) => ({
    label: t.label,
    value: perTopic[i],
  }))
    .sort((a, b) => a.value - b.value)
    .map((item, i) => ({ ...item, highlight: i === 0 }));

  const avgMinutes =
    stats.avgDurationSeconds != null
      ? Math.round(stats.avgDurationSeconds / 60)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {extraKpis}
        <KpiCard
          label="Sessions run"
          value={String(stats.sessions)}
          sub={
            stats.scoredSessions === stats.sessions
              ? undefined
              : `${stats.scoredSessions} scored`
          }
        />
        <KpiCard
          label="Average score"
          value={stats.avgScore != null ? stats.avgScore.toFixed(1) : "—"}
          sub="out of 10"
          hoverTitle={`Mean overall score across ${stats.scoredSessions} scored session(s)`}
        />
        <KpiCard
          label="Feedback adopted"
          value={
            stats.adoptionRate != null
              ? `${Math.round(stats.adoptionRate * 100)}%`
              : "—"
          }
          sub="of coaching points taken on"
        />
        <KpiCard
          label="Average length"
          value={avgMinutes != null ? `${avgMinutes}m` : "—"}
          sub="per completed session"
        />
      </div>

      {contributing === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          No scored sessions in {scope} yet. The charts here fill in as soon as
          students start running {copy.sessionNoun}s.
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-6">
              <h3 className="font-semibold text-ink">What to teach next</h3>
              <p className="mt-0.5 text-sm text-muted">
                Average per topic across {scope}, weakest first.
              </p>
              <div className="mt-6">
                <TopicBars items={barItems} max={10} />
              </div>
            </section>

            <section className="card p-6">
              <h3 className="font-semibold text-ink">Where students drop off</h3>
              <p className="mt-0.5 text-sm text-muted">
                {features.resume
                  ? "A resume is required before a session can start, so anyone stuck there hasn't been able to begin."
                  : `Every stage from being assigned a ${copy.unitSingular} through to a scored ${copy.sessionNoun}.`}
              </p>
              <div className="mt-5">
                <FunnelBar funnel={funnel} />
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="card p-6">
              <h3 className="font-semibold text-ink">
                Does it get better with practice?
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                Everyone&apos;s first session, then everyone&apos;s second, and
                so on — plotted by session number rather than by date, so this
                measures practice and not who started early.
              </p>
              <div className="mt-4">
                <SessionsChart
                  points={progress.points.map((p) => ({
                    label: p.label,
                    value: p.value,
                  }))}
                  categories={progress.perTopic}
                  max={10}
                  emptyMessage={`Not enough repeat sessions in ${scope} yet — this needs at least two students on their second ${copy.sessionNoun} before a trend means anything.`}
                />
              </div>
            </section>

            <section className="card p-6">
              <h3 className="font-semibold text-ink">Shape of {scope}</h3>
              <p className="mt-0.5 text-sm text-muted">
                Average across all {topics.length} topics — a lopsided shape is
                a syllabus gap, not an individual&apos;s problem.
              </p>
              <div className="mt-4">
                <TopicRadar
                  axes={topics.map((t) => t.label)}
                  series={[
                    {
                      label: "Average",
                      color: "var(--brand)",
                      values: perTopic,
                    },
                  ]}
                  max={10}
                />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
