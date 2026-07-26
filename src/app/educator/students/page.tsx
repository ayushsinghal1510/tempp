import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import { orgStudentRounds } from "@/lib/practice/educatorQueries";
import { stuckTopics } from "@/lib/practice/educatorMetrics";
import { aggregate, topicLabel } from "@/lib/practice/metrics";
import { tenantConfig } from "@/lib/tenants/config";
import { qualitativeTrend } from "@/lib/practice/summarize";

export const dynamic = "force-dynamic";

export default async function EducatorStudentsPage() {
  const user = await requireUser(["practice_admin"], "/educator/login");
  const unitPlural = tenantConfig(user.tenant).copy.unitPlural;
  const orgId = await requireEducatorOrgId(user.id);
  const { topics, features } = tenantConfig(user.tenant);
  const scoring = features.scoring;

  const students = await orgStudentRounds(orgId);

  const rows = students
    .map((s) => ({
      ...s,
      stats: aggregate(s.rounds, topics),
      stuckCount: stuckTopics(s.rounds, topics).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DashboardShell user={user} nav={educatorNav(unitPlural)} title="Students">
      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="font-semibold text-ink">
            Every student you&apos;ve assigned work to
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {scoring
              ? "Sessions a student ran on companies they added themselves are not shown here — those are private to them."
              : "Everyone in your organisation, with the sessions they've run."}
          </p>
        </section>

        {rows.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No students yet. Create a class, share its code, then assign a
            company.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wide text-faint">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Sessions</th>
                  {scoring && (
                    <>
                      <th className="px-4 py-2.5">Trend</th>
                      <th className="px-4 py-2.5">Strongest</th>
                      <th className="px-4 py-2.5">Weakest</th>
                      <th className="px-4 py-2.5">Adopted</th>
                      <th className="px-4 py-2.5">Stuck</th>
                    </>
                  )}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{r.name}</div>
                      <div className="text-xs text-muted">{r.email}</div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {r.stats.totalSessions}
                    </td>
                    {scoring && (
                      <>
                        <td className="px-4 py-2.5">
                          {qualitativeTrend(r.stats.avgImprovement)}
                        </td>
                        <td className="px-4 py-2.5">
                          {topicLabel(r.stats.bestTopic, topics)}
                        </td>
                        <td className="px-4 py-2.5">
                          {topicLabel(r.stats.worstTopic, topics)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {r.stats.adoptionRate != null
                            ? `${Math.round(r.stats.adoptionRate * 100)}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.stuckCount > 0 ? (
                            <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                              {r.stuckCount}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/educator/students/${r.userId}`}
                        className="font-medium text-brand hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
