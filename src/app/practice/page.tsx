import { requireUser } from "@/lib/auth/session";
import { getUserCompaniesWithRounds } from "@/lib/practice/cachedQueries";
import PracticeHeader from "@/components/practice/PracticeHeader";
import KpiCard from "@/components/practice/KpiCard";
import ChartInfoButton from "@/components/practice/ChartInfoButton";
import SessionsChart from "@/components/charts/bklit/SessionsChart";
import TopicRadar from "@/components/charts/bklit/TopicRadar";
import TopicBars from "@/components/charts/bklit/TopicBars";
import { tenantConfig } from "@/lib/tenants/config";
import {
  aggregate,
  latestTopicScores,
  overallScore,
  topicLabel,
} from "@/lib/practice/metrics";
import { summarizeStats, qualitativeTrend } from "@/lib/practice/summarize";
import {
  SESSIONS_CHART_STEPS,
  RADAR_STEPS,
  BARS_STEPS,
} from "@/lib/practice/chartExplainers";

export const dynamic = "force-dynamic";

export default async function PracticeHomePage() {
  const user = await requireUser(["practice"], "/practice/login");
  const { topics, features, copy } = tenantConfig(user.tenant);
  const companies = await getUserCompaniesWithRounds(user.id);

  const allRounds = companies.flatMap((c) => c.rounds);
  const overall = aggregate(allRounds, topics);

  const orderedRounds = allRounds
    .slice()
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const timeline = orderedRounds.map((r, i) => ({
    label: `S${i + 1}`,
    value: r.turns.some((t) => t.topics != null) ? overallScore(r, topics) : 0,
  }));

  const categorySeries = topics.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    values: orderedRounds.map((r) =>
      r.turns.some((tn) => tn.topics != null)
        ? latestTopicScores(r, topics)[t.key]
        : 0,
    ),
  }));

  const radarSeries =
    allRounds.length > 0
      ? [
          {
            label: "Average",
            color: "var(--brand)",
            values: overall.avgPerTopic,
          },
        ]
      : [];

  const barItems = topics.map((t, i) => ({
    label: t.label,
    value: overall.avgPerTopic[i],
  }))
    .sort((a, b) => a.value - b.value)
    .map((item, i) => ({ ...item, highlight: i === 0 }));

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <div className="card p-5 text-sm font-medium text-ink">
          {features.scoring
            ? summarizeStats(overall, topics)
            : `You've run ${overall.totalSessions} ${overall.totalSessions === 1 ? copy.sessionNoun : copy.sessionNoun + "s"}. Open any one to play the recording back and read the transcript.`}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total sessions"
            value={String(overall.totalSessions)}
          />
          {features.scoring && (
            <>
          <KpiCard
            label="Average improvement"
            value={qualitativeTrend(overall.avgImprovement)}
            hoverTitle={
              overall.avgImprovement != null
                ? `Exact: ${overall.avgImprovement >= 0 ? "+" : ""}${overall.avgImprovement.toFixed(1)}`
                : undefined
            }
          />
          <KpiCard
            label="Best qualities"
            value={topicLabel(overall.bestTopic, topics)}
          />
          <KpiCard
            label="Worst qualities"
            value={topicLabel(overall.worstTopic, topics)}
          />
            </>
          )}
        </div>

        {features.scoring && allRounds.length > 0 ? (
          <div className="space-y-6">
            <section className="card p-6">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink">Sessions over time</h3>
                <ChartInfoButton
                  chartTitle="Sessions over time"
                  steps={SESSIONS_CHART_STEPS}
                />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Overall score, across every company.
              </p>
              <div className="mt-4">
                <SessionsChart
                  points={timeline}
                  categories={categorySeries}
                  max={10}
                />
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="card p-6">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink">Average shape</h3>
                  <ChartInfoButton chartTitle="Average shape" steps={RADAR_STEPS} />
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Averaged across every session, every company.
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
                  Where to focus next, across all companies.
                </p>
                <div className="mt-6">
                  <TopicBars items={barItems} max={10} />
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-sm text-muted">
            {allRounds.length > 0
              ? `Open a ${copy.unitSingular} to see your sessions.`
              : features.company
                ? "No sessions yet — add a company to start your first one."
                : `No sessions yet — open a ${copy.unitSingular} to start your first one.`}
          </div>
        )}
      </div>
    </main>
  );
}
