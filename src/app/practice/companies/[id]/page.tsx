import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  getCompanyWithRounds,
  getUserCompanyList,
} from "@/lib/practice/cachedQueries";
import { tierProfile } from "@/lib/research/tierProfiles";
import type { CompanyResearch } from "@/lib/research/companyResearch";
import {
  academicTierForCgpa,
  expectationRow,
  DEGREE_LABEL,
  ACADEMIC_TIER_LABEL,
} from "@/lib/research/expectationMatrix";
import { createSession } from "@/lib/actions/practice";
import PracticeHeader from "@/components/practice/PracticeHeader";
import KpiCard from "@/components/practice/KpiCard";
import ChartInfoButton from "@/components/practice/ChartInfoButton";
import Collapsible from "@/components/practice/Collapsible";
import CompanyResearchPanel from "@/components/practice/CompanyResearchPanel";
import FocusTable from "@/components/practice/FocusTable";
import SessionsTable, {
  type SessionRow,
} from "@/components/practice/SessionsTable";
import SessionsChart from "@/components/charts/bklit/SessionsChart";
import TopicRadar from "@/components/charts/bklit/TopicRadar";
import TopicBars from "@/components/charts/bklit/TopicBars";
import { TOPIC_META } from "@/lib/practice/topics";
import {
  aggregate,
  latestTopicScores,
  overallScore,
  sessionImprovement,
  sessionDurationSeconds,
  bestWorstTopic,
  topicLabel,
} from "@/lib/practice/metrics";
import { summarizeStats, qualitativeTrend } from "@/lib/practice/summarize";
import {
  SESSIONS_CHART_STEPS,
  RADAR_STEPS,
  BARS_STEPS,
} from "@/lib/practice/chartExplainers";
import CompanySwitcher from "./CompanySwitcher";

export const dynamic = "force-dynamic";

export default async function PracticeCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionUser = await requireUser(["practice"], "/practice/login");

  const [company, allCompanies, profileUser, resumeChat] = await Promise.all([
    getCompanyWithRounds(id),
    getUserCompanyList(sessionUser.id),
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { course: true, cgpa: true },
    }),
    prisma.practiceResumeChat.findUnique({
      where: { companyId: id },
      select: { id: true },
    }),
  ]);

  if (!company || company.userId !== sessionUser.id) notFound();

  const stats = aggregate(company.rounds);
  const profile = tierProfile(company.tier);
  const research = company.companyResearch as CompanyResearch | null;

  // Course/CGPA are optional at signup — default to B.Tech Tier 1 so this
  // always has something to show instead of blocking on profile data.
  const usedDefaultProfile =
    profileUser?.course == null || profileUser?.cgpa == null;
  const effectiveCourse = profileUser?.course ?? "btech";
  const effectiveAcademicTier =
    profileUser?.cgpa != null ? academicTierForCgpa(profileUser.cgpa) : "tier_1";
  const focus = expectationRow(effectiveCourse, effectiveAcademicTier);

  const timeline = company.rounds.map((r, i) => ({
    label: `S${i + 1}`,
    value: r.turns.some((t) => t.topics != null) ? overallScore(r) : 0,
  }));

  const categorySeries = TOPIC_META.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    values: company.rounds.map((r) =>
      r.turns.some((tn) => tn.topics != null) ? latestTopicScores(r)[t.key] : 0,
    ),
  }));

  const radarSeries =
    company.rounds.length > 0
      ? [{ label: "Average", color: "var(--brand)", values: stats.avgPerTopic }]
      : [];

  const barItems = TOPIC_META.map((t, i) => ({
    label: t.label,
    value: stats.avgPerTopic[i],
  }))
    .sort((a, b) => a.value - b.value)
    .map((item, i) => ({ ...item, highlight: i === 0 }));

  const sessionRows: SessionRow[] = company.rounds.map((r, i) => ({
    id: r.id,
    label: `Session ${i + 1}`,
    companyId: company.id,
    companyName: company.companyName,
    date: r.createdAt,
    durationSeconds: sessionDurationSeconds(r),
    turnCount: r.turns.length,
    bestTopic: bestWorstTopic(r)?.best ?? null,
    worstTopic: bestWorstTopic(r)?.worst ?? null,
    improvement: sessionImprovement(r),
    completed: r.status === "completed",
  }));

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={sessionUser.name} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <Link
          href="/practice/companies"
          className="text-sm text-muted hover:text-ink"
        >
          ← Companies
        </Link>

        <section className="card flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">
              {company.companyName}
            </h1>
            {company.jobTitle && (
              <p className="mt-0.5 text-sm text-muted">{company.jobTitle}</p>
            )}
            {profile && (
              <span className="mt-2 inline-block rounded-lg border border-line px-3 py-1 text-xs font-semibold text-muted">
                {profile.label} · {profile.salaryBand}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <CompanySwitcher companies={allCompanies} currentId={company.id} />
            <Link
              href={`/practice/companies/${company.id}/resume-chat`}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-line-strong"
            >
              Resume &amp; career chat
            </Link>
            {resumeChat ? (
              <form action={createSession.bind(null, company.id)}>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
                >
                  Start new session →
                </button>
              </form>
            ) : (
              <Link
                href={`/practice/companies/${company.id}/resume-chat`}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
              >
                Upload resume to begin →
              </Link>
            )}
          </div>
        </section>

        <div className="card p-5 text-sm font-medium text-ink">
          {summarizeStats(stats)}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Average improvement"
            value={qualitativeTrend(stats.avgImprovement)}
            hoverTitle={
              stats.avgImprovement != null
                ? `Exact: ${stats.avgImprovement >= 0 ? "+" : ""}${stats.avgImprovement.toFixed(1)}`
                : undefined
            }
          />
          <KpiCard label="Best quality" value={topicLabel(stats.bestTopic)} />
          <KpiCard label="Worst quality" value={topicLabel(stats.worstTopic)} />
          <div className="card p-4" />
        </div>

        {company.rounds.length > 0 && (
          <div className="space-y-6">
            <section className="card p-6">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink">Sessions over time</h3>
                <ChartInfoButton
                  chartTitle="Sessions over time"
                  steps={SESSIONS_CHART_STEPS}
                />
              </div>
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
                <div className="mt-6">
                  <TopicBars items={barItems} max={10} />
                </div>
              </section>
            </div>
          </div>
        )}

        <Collapsible
          title="Company research & prep"
          subtitle="What this company tends to ask, plus your personalized focus areas."
        >
          <CompanyResearchPanel
            research={research}
            companyName={company.companyName}
          />
          <section className="card p-6">
            <h3 className="font-semibold text-ink">
              What we&apos;ll focus on for you
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {DEGREE_LABEL[effectiveCourse]} ·{" "}
              {ACADEMIC_TIER_LABEL[effectiveAcademicTier]}
              {usedDefaultProfile && (
                <>
                  {" "}
                  — default, add your course &amp; CGPA to{" "}
                  <Link
                    href="/practice/signup"
                    className="text-brand hover:underline"
                  >
                    personalize this
                  </Link>
                </>
              )}
            </p>
            <div className="mt-4">
              <FocusTable focus={focus} />
            </div>
          </section>
        </Collapsible>

        <section>
          <h2 className="text-lg font-semibold text-ink">Sessions</h2>
          <div className="mt-3">
            <SessionsTable sessions={sessionRows} showCompanyColumn={false} />
          </div>
        </section>
      </div>
    </main>
  );
}
