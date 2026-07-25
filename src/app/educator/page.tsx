import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { EDUCATOR_NAV } from "@/lib/nav";
import {
  orgFunnelRows,
  orgOverview,
  orgStudentRounds,
} from "@/lib/practice/educatorQueries";
import {
  assignmentFunnel,
  bailOuts,
  classWeakest,
  cohortFirstVsLatest,
  triageList,
  weakestTopicCounts,
} from "@/lib/practice/educatorMetrics";
import { TOPIC_META } from "@/lib/practice/topics";
import { topicLabel } from "@/lib/practice/metrics";
import KpiCard from "@/components/practice/KpiCard";
import TriageTable from "@/components/educator/TriageTable";
import CohortAnalytics from "@/components/educator/CohortAnalytics";

export const dynamic = "force-dynamic";

export default async function EducatorDashboardPage() {
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);

  const [overview, students, funnelRows] = await Promise.all([
    orgOverview(orgId),
    orgStudentRounds(orgId),
    orgFunnelRows(orgId),
  ]);

  const triage = triageList(students);
  const { perTopic, contributing } = classWeakest(students);
  const weakCounts = weakestTopicCounts(students);
  const funnel = assignmentFunnel(funnelRows);
  const growth = cohortFirstVsLatest(students);
  const quit = bailOuts(students);

  const weakestIdx = perTopic.reduce(
    (lo, v, i) => (v < perTopic[lo] ? i : lo),
    0,
  );

  const quota = overview.org;
  const quotaLeft = quota
    ? Math.max(0, quota.sessionsAllotted - quota.sessionsUsed)
    : 0;

  return (
    <DashboardShell
      user={user}
      nav={EDUCATOR_NAV}
      title="Dashboard"
      org={overview.org?.name}
    >
      <div className="space-y-6">
        {contributing === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No scored sessions yet. Once your students run their first
            interviews, this page fills in.{" "}
            <Link href="/educator/companies" className="text-brand hover:underline">
              Add a company
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="card p-5 text-sm font-medium text-ink">
            {weakCounts[weakestIdx]} of {contributing} student
            {contributing === 1 ? "" : "s"}{" "}
            {weakCounts[weakestIdx] === 1 ? "is" : "are"} weakest on{" "}
            {topicLabel(TOPIC_META[weakestIdx].key)}
            {growth
              ? ` — and across ${growth.students} student${growth.students === 1 ? "" : "s"} with repeat sessions, scores have moved ${growth.first.toFixed(1)} → ${growth.latest.toFixed(1)}.`
              : "."}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Students" value={String(overview.students)} />
          <KpiCard
            label="Companies"
            value={String(overview.companies)}
            sub={`${overview.groups} class${overview.groups === 1 ? "" : "es"}`}
          />
          <KpiCard
            label="Need attention"
            value={String(triage.length)}
            sub="stuck on a dropped point"
          />
          <KpiCard
            label="Sessions left"
            value={String(quotaLeft)}
            sub={quota ? `of ${quota.sessionsAllotted} contracted` : undefined}
          />
        </div>

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Students who need you</h3>
          <p className="mt-0.5 text-sm text-muted">
            The coach raised the same point repeatedly and they never took it
            on — so it stopped raising it. These need a human.
          </p>
          <div className="mt-4">
            <TriageTable rows={triage} />
          </div>
        </section>

        <CohortAnalytics
          students={students}
          funnel={funnel}
          scope="your students"
        />

        {quit.length > 0 && (
          <p className="card p-5 text-sm text-muted">
            <span className="font-medium text-ink">
              {quit.length} session{quit.length === 1 ? "" : "s"}
            </span>{" "}
            ended after fewer than four turns — those are quits, not short
            sessions.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
