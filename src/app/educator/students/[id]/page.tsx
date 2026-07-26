import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import { orgStudentRounds } from "@/lib/practice/educatorQueries";
import { cohortStats, stuckTopics } from "@/lib/practice/educatorMetrics";
import KpiCard from "@/components/practice/KpiCard";
import {
  aggregate,
  latestTopicScores,
  overallScore,
  sessionDurationSeconds,
  sessionImprovement,
  topicLabel,
} from "@/lib/practice/metrics";
import { summarizeStats, qualitativeTrend } from "@/lib/practice/summarize";
import { tenantConfig, topicsFor } from "@/lib/tenants/config";
import { DEGREE_LABEL } from "@/lib/research/expectationMatrix";
import SessionsChart from "@/components/charts/bklit/SessionsChart";
import TopicRadar from "@/components/charts/bklit/TopicRadar";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function EducatorStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice_admin"], "/educator/login");
  const unitPlural = tenantConfig(user.tenant).copy.unitPlural;
  const orgId = await requireEducatorOrgId(user.id);
  const topics = topicsFor(user.tenant);

  // Sourced from the org-scoped query, so a student with no assignment from
  // this educator simply isn't here — no separate authorisation step needed.
  const students = await orgStudentRounds(orgId);
  const student = students.find((s) => s.userId === id);
  if (!student) notFound();

  const profile = await prisma.user.findUnique({
    where: { id },
    select: { course: true, cgpa: true },
  });

  const stats = aggregate(student.rounds, topics);
  // Same helper the class and company pages use, over a one-student cohort —
  // so "average score" on this page is the same computation as everywhere else.
  const solo = cohortStats([student], topics);
  const stuck = stuckTopics(student.rounds, topics);
  const scored = student.rounds.filter((r) =>
    r.turns.some((t) => t.topics != null),
  );

  const timeline = student.rounds.map((r, i) => ({
    label: `S${i + 1}`,
    value: r.turns.some((t) => t.topics != null) ? overallScore(r, topics) : 0,
  }));

  const categorySeries = topics.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    values: student.rounds.map((r) =>
      r.turns.some((tn) => tn.topics != null)
        ? latestTopicScores(r, topics)[t.key]
        : 0,
    ),
  }));

  const radarSeries =
    scored.length > 0
      ? [
          {
            label: "Average",
            color: "var(--brand)",
            values: stats.avgPerTopic,
          },
        ]
      : [];

  return (
    <DashboardShell user={user} nav={educatorNav(unitPlural)} title={student.name}>
      <div className="space-y-6">
        <Link
          href="/educator/students"
          className="text-sm text-muted hover:text-ink"
        >
          ← Students
        </Link>

        <section className="card p-6">
          <h2 className="text-xl font-bold text-ink">{student.name}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {student.email}
            {profile?.course && ` · ${DEGREE_LABEL[profile.course]}`}
            {profile?.cgpa != null && ` · CGPA ${profile.cgpa}`}
          </p>
        </section>

        <div className="card p-5 text-sm font-medium text-ink">
          {summarizeStats(stats, topics)}
        </div>

        {stuck.length > 0 && (
          <section className="card border-danger/30 p-6">
            <h3 className="font-semibold text-ink">Not taking feedback on</h3>
            <p className="mt-0.5 text-sm text-muted">
              The coach raised these repeatedly and got no engagement, so it
              stopped raising them. Worth a conversation.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stuck.map((s) => (
                <span
                  key={s.topicKey}
                  className="rounded-md bg-danger-soft px-2.5 py-1 text-sm font-medium text-danger"
                >
                  {topicLabel(s.topicKey, topics)} — raised {s.repeated}×, currently{" "}
                  {s.score.toFixed(1)}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Sessions"
            value={String(stats.totalSessions)}
            sub={
              scored.length === stats.totalSessions
                ? undefined
                : `${scored.length} scored`
            }
          />
          <KpiCard
            label="Latest score"
            value={
              solo.avgScore != null ? solo.avgScore.toFixed(1) : "—"
            }
            sub="out of 10, averaged"
          />
          <KpiCard
            label="Trend"
            value={qualitativeTrend(stats.avgImprovement)}
            hoverTitle={
              stats.avgImprovement != null
                ? `${stats.avgImprovement >= 0 ? "+" : ""}${stats.avgImprovement.toFixed(2)} average change per session`
                : undefined
            }
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
        </div>

        {scored.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="card p-6">
              <h3 className="font-semibold text-ink">Sessions over time</h3>
              <div className="mt-4">
                <SessionsChart
                  points={timeline}
                  categories={categorySeries}
                  max={10}
                />
              </div>
            </section>
            <section className="card p-6">
              <h3 className="font-semibold text-ink">Average shape</h3>
              <div className="mt-4">
                <TopicRadar
                  axes={topics.map((t) => t.label)}
                  series={radarSeries}
                  max={10}
                />
              </div>
            </section>
          </div>
        )}

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Sessions</h3>
          {student.rounds.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Hasn&apos;t run a session yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-faint">
                  <tr className="border-b border-line">
                    <th className="pb-2">Session</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Turns</th>
                    <th className="pb-2">Length</th>
                    <th className="pb-2">Change</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {student.rounds.map((r, i) => {
                    const improvement = sessionImprovement(r, topics);
                    return (
                      <tr key={r.id} className="border-b border-line last:border-0">
                        <td className="py-2.5 font-medium text-ink">
                          Session {i + 1}
                        </td>
                        <td className="py-2.5 text-muted">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 tabular-nums text-muted">
                          {r.turns.length}
                        </td>
                        <td className="py-2.5 tabular-nums text-muted">
                          {formatDuration(sessionDurationSeconds(r))}
                        </td>
                        <td className="py-2.5 tabular-nums text-muted">
                          {improvement != null
                            ? `${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}`
                            : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            href={`/educator/sessions/${r.id}`}
                            className="font-medium text-brand hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
