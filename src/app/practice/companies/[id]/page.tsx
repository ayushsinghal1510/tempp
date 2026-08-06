import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  getCompanyWithRounds,
  getUserCompanyList,
} from "@/lib/practice/cachedQueries";
import {
  getResumeChatFor,
  requireAccessibleCompany,
} from "@/lib/practice/access";
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
import { tenantConfig } from "@/lib/tenants/config";
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
import { deadlineState } from "@/lib/practice/deadline";
import TailorResumeButton from "@/components/practice/TailorResumeButton";
import CompanySwitcher from "./CompanySwitcher";

export const dynamic = "force-dynamic";

export default async function PracticeCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionUser = await requireUser(["practice"], "/practice/login");
  const { topics, features, copy } = tenantConfig(sessionUser.tenant);

  // Access first: 404 unless this user may actually use the company. Only
  // then load the (user-scoped) rounds and the rest of the page.
  await requireAccessibleCompany(sessionUser.id, id);

  const [company, allCompanies, profileUser, resumeChat, assignment] =
    await Promise.all([
    getCompanyWithRounds(id, sessionUser.id),
    getUserCompanyList(sessionUser.id),
    // Only read to build the expectation matrix, which is engineering-shaped
    // and hidden on every tenant without a course field — so on nim and cus
    // this query would fetch two columns nothing renders.
    features.courseField
      ? prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { course: true, cgpa: true },
        })
      : null,
    features.resume ? getResumeChatFor(sessionUser.id, id) : null,
    prisma.practiceAssignment.findUnique({
      where: { companyId_userId: { companyId: id, userId: sessionUser.id } },
      select: { dueDate: true, unlockedAt: true },
    }),
  ]);

  if (!company) notFound();

  // A self-registered company has no assignment and therefore no deadline.
  // createSession enforces this again server-side — this only decides whether
  // the student is shown a button that would refuse them.
  const deadline = assignment ? deadlineState(assignment) : null;
  const locked = deadline?.status === "locked";

  const stats = aggregate(company.rounds, topics);
  const profile = features.company ? tierProfile(company.tier) : null;
  const research = features.research
    ? (company.companyResearch as CompanyResearch | null)
    : null;

  // Course/CGPA are optional at signup — default to B.Tech Tier 1 so this
  // always has something to show instead of blocking on profile data.
  const usedDefaultProfile =
    profileUser?.course == null || profileUser?.cgpa == null;
  const effectiveCourse = profileUser?.course ?? "btech";
  const effectiveAcademicTier =
    profileUser?.cgpa != null ? academicTierForCgpa(profileUser.cgpa) : "tier_1";
  const focus = features.courseField
    ? expectationRow(effectiveCourse, effectiveAcademicTier)
    : null;

  const timeline = company.rounds.map((r, i) => ({
    label: `S${i + 1}`,
    value: r.turns.some((t) => t.topics != null) ? overallScore(r, topics) : 0,
  }));

  const categorySeries = topics.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    values: company.rounds.map((r) =>
      r.turns.some((tn) => tn.topics != null)
        ? latestTopicScores(r, topics)[t.key]
        : 0,
    ),
  }));

  const radarSeries =
    company.rounds.length > 0
      ? [{ label: "Average", color: "var(--brand)", values: stats.avgPerTopic }]
      : [];

  const barItems = topics.map((t, i) => ({
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
    bestTopic: bestWorstTopic(r, topics)?.best ?? null,
    worstTopic: bestWorstTopic(r, topics)?.worst ?? null,
    improvement: sessionImprovement(r, topics),
    completed: r.status === "completed",
  }));

  return (
    <main className="practice-page min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={sessionUser.name} tenant={sessionUser.tenant} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <Link
          href="/practice/companies"
          className="text-sm text-muted hover:text-ink"
        >
          ←{" "}
          {copy.unitPlural.charAt(0).toUpperCase() + copy.unitPlural.slice(1)}
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
            {features.resume && (
              <>
                <Link
                  href={`/practice/companies/${company.id}/resume-chat`}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-line-strong"
                >
                  Resume &amp; career chat
                </Link>
                <TailorResumeButton companyId={company.id} />
              </>
            )}
            {locked ? (
              <div className="text-right">
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg bg-faint/20 px-4 py-2 text-sm font-semibold text-faint"
                >
                  Locked
                </button>
                <p className="mt-1 text-xs text-danger">
                  Deadline passed{" "}
                  {deadline?.dueDate?.toLocaleDateString()} — ask your educator
                  to reopen.
                </p>
              </div>
            ) : /* The resume branch is jer's alone. Keyed off the feature and
                  not off `resumeChat` being null, which is also null on every
                  tenant that has no resumes — that read sent nim and cus
                  students to "Upload resume to begin". */
            features.resume && !resumeChat ? (
              <Link
                href={`/practice/companies/${company.id}/resume-chat`}
                className="rounded-lg bg-[var(--chart-1)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                Upload resume to begin →
              </Link>
            ) : (
              <form action={createSession.bind(null, company.id)}>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--chart-1)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                >
                  Start new {copy.sessionNoun} →
                </button>
              </form>
            )}
          </div>
        </section>

        {features.scoring && (
          <>
            <div className="card p-5 text-sm font-medium text-ink">
              {summarizeStats(stats, topics)}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard
                label="Average improvement"
                value={qualitativeTrend(stats.avgImprovement)}
                hoverTitle={
                  stats.avgImprovement != null
                    ? `Exact: ${stats.avgImprovement >= 0 ? "+" : ""}${stats.avgImprovement.toFixed(1)}`
                    : undefined
                }
              />
              <KpiCard
                label="Best quality"
                value={topicLabel(stats.bestTopic, topics)}
              />
              <KpiCard
                label="Worst quality"
                value={topicLabel(stats.worstTopic, topics)}
              />
            </div>
          </>
        )}

        {features.scoring && company.rounds.length > 0 && (
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
                <div className="mt-6">
                  <TopicBars items={barItems} max={10} />
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Research is jer's (Groq runs at company creation); the focus table
            is the engineering degree/CGPA expectation matrix. Neither exists
            on nim or cus, and the whole panel disappears when both are off
            rather than collapsing to an empty accordion. */}
        {(features.research || features.courseField) && (
          <Collapsible
            title={`${copy.unitTitle} research & prep`}
            subtitle={`What this ${copy.unitSingular} tends to ask, plus your personalized focus areas.`}
          >
            {features.research && (
              <CompanyResearchPanel
                research={research}
                companyName={company.companyName}
              />
            )}
            {features.courseField && focus && (
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
            )}
          </Collapsible>
        )}

        <section>
          <h2 className="text-lg font-semibold text-ink">
            {copy.sessionNoun.charAt(0).toUpperCase() +
              copy.sessionNoun.slice(1)}
            s
          </h2>
          <div className="mt-3">
            <SessionsTable
              sessions={sessionRows}
              topics={topics}
              showCompanyColumn={false}
              unitTitle={copy.unitTitle}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
