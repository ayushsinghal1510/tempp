import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getUserCompaniesWithRounds } from "@/lib/practice/cachedQueries";
import { resumeChatCompanyIds } from "@/lib/practice/access";
import { upNextFrom } from "@/lib/practice/upNext";
import UpNextCards from "@/components/practice/UpNextCards";
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

  // Only jer gates on a resume, so only jer pays for the lookup.
  const resumeIds = features.resume
    ? await resumeChatCompanyIds(user.id)
    : new Set<string>();
  const cards = upNextFrom(companies, user.tenant, resumeIds);

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
    <main className="practice-page min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} tenant={user.tenant} />

      <div className="mx-auto w-full max-w-[1800px] space-y-8 px-5 py-8 sm:px-6 sm:py-10">
        {/* ── The action, first ────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
                Your practice desk
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Hi {user.name.split(" ")[0]}, ready when you are.
              </h1>
              <p className="mt-1 text-sm text-muted">
                Pick up the thread, practise deliberately, and make the next round count.
              </p>
            </div>
            <Link
              href="/practice/companies"
              className="mb-1 shrink-0 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-ink transition hover:border-line-strong hover:bg-brand-soft"
            >
              View all {copy.unitPlural} →
            </Link>
          </div>

          {cards.length > 0 ? (
            <UpNextCards cards={cards} />
          ) : (
            <div className="card p-8 text-center text-sm text-muted">
              {features.company
                ? `Nothing here yet — register a ${copy.unitSingular} to run your first ${copy.sessionNoun}.`
                : features.assignments
                  ? `Nothing assigned yet. Your educator will add ${copy.unitPlural} here.`
                  : `Nothing published yet. ${copy.unitTitle}s your organisation publishes will appear here.`}
            </div>
          )}
        </section>

        {/* ── The numbers, second ──────────────────────────────────────── */}
        <div className="overflow-hidden rounded-[18px] bg-brand px-5 py-5 text-sm text-primary-foreground shadow-sm sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brass-lit)]">
            Progress note
          </p>
          <p className="mt-2 max-w-4xl text-base font-medium leading-relaxed">
            {features.scoring
              ? summarizeStats(overall, topics)
              : `You've run ${overall.totalSessions} ${overall.totalSessions === 1 ? copy.sessionNoun : copy.sessionNoun + "s"}. Open any one to play the recording back and read the transcript.`}
          </p>
        </div>

        {/* A lone KPI in a four-column grid reads as three broken cards, so
            the row only exists where there are scores to fill it. */}
        {features.scoring && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total sessions"
              value={String(overall.totalSessions)}
            />
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
          </div>
        )}

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
                Overall score, across every {copy.unitSingular}.
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
                  Averaged across every {copy.sessionNoun}, every{" "}
                  {copy.unitSingular}.
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
                  Where to focus next, across all {copy.unitPlural}.
                </p>
                <div className="mt-6">
                  <TopicBars items={barItems} max={10} />
                </div>
              </section>
            </div>
          </div>
        ) : features.scoring ? (
          // Only on scored tenants: on cus there is nothing to chart ever, so
          // an empty analytics slot would be permanent furniture. The "up
          // next" section above already covers having nothing to do yet.
          <div className="card p-8 text-center text-sm text-muted">
            Run your first {copy.sessionNoun} and your progress will show up
            here.
          </div>
        ) : null}
      </div>
    </main>
  );
}
