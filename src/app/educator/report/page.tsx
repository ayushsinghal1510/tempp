import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import { tenantConfig } from "@/lib/tenants/config";
import { buildReport } from "@/lib/practice/reportData";
import { topicLabel } from "@/lib/practice/metrics";
import ReportControls from "@/components/educator/ReportControls";

export const dynamic = "force-dynamic";

/**
 * The printable report. Deliberately not inside DashboardShell: this page
 * exists to be printed to PDF and handed on, so it must not carry a sidebar,
 * a nav or anything else that only makes sense on screen.
 */
export default async function EducatorReportPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; groupId?: string }>;
}) {
  const { companyId, groupId } = await searchParams;
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);
  const { topics, copy, features } = tenantConfig(user.tenant);

  const [org, companies, groups, report] = await Promise.all([
    prisma.practiceOrg.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    prisma.practiceCompany.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, companyName: true },
    }),
    prisma.practiceGroup.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    buildReport(orgId, topics, { companyId, groupId }),
  ]);

  const { rows, summary } = report;
  const scoped = [
    companies.find((c) => c.id === companyId)?.companyName,
    groups.find((g) => g.id === groupId)?.name,
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 text-ink">
      <ReportControls
        companies={companies}
        groups={groups}
        companyId={companyId ?? ""}
        groupId={groupId ?? ""}
        unitTitle={copy.unitTitle}
      />

      <header className="mb-6">
        <h1 className="text-2xl font-bold">{org?.name ?? "Practice report"}</h1>
        <p className="mt-1 text-sm text-muted">
          {scoped.length > 0 ? scoped.join(" · ") : "All classes and all " + copy.unitPlural}
          {" · generated "}
          {new Date().toLocaleDateString()}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: "Students", value: summary.students },
          { label: "Assignments", value: summary.assignments },
          { label: "Done", value: summary.done },
          { label: "In progress", value: summary.inProgress },
          { label: "Overdue", value: summary.overdue },
          { label: "Missed", value: summary.missed },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-line p-3">
            <div className="text-xs uppercase tracking-wide text-faint">
              {k.label}
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">
              {k.value}
            </div>
          </div>
        ))}
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing assigned yet, so there is nothing to report.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="py-2 pr-3">Student</th>
                <th className="py-2 pr-3">Class</th>
                <th className="py-2 pr-3">{copy.unitTitle}</th>
                <th className="py-2 pr-3">Due</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Sessions</th>
                {features.scoring && (
                  <>
                    <th className="py-2 pr-3">Trend</th>
                    <th className="py-2 pr-3">Strongest</th>
                    <th className="py-2 pr-3">Weakest</th>
                    <th className="py-2">Adopted</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={`${r.studentEmail}-${r.unitName}-${i}`}>
                  <td className="py-2 pr-3">
                    <div>{r.studentName}</div>
                    <div className="text-xs text-faint">{r.studentEmail}</div>
                  </td>
                  <td className="py-2 pr-3 text-muted">{r.className}</td>
                  <td className="py-2 pr-3 text-muted">{r.unitName}</td>
                  <td className="py-2 pr-3 text-muted">
                    {r.dueDate ? r.dueDate.toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 pr-3">{r.status}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.completedSessions}/{r.minSessions}
                  </td>
                  {features.scoring && (
                    <>
                      <td className="py-2 pr-3 tabular-nums">
                        {r.avgImprovement != null
                          ? `${r.avgImprovement >= 0 ? "+" : ""}${r.avgImprovement.toFixed(1)}`
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {topicLabel(r.bestTopic, topics)}
                      </td>
                      <td className="py-2 pr-3">
                        {topicLabel(r.worstTopic, topics)}
                      </td>
                      <td className="py-2 tabular-nums">
                        {r.adoptionRate != null
                          ? `${Math.round(r.adoptionRate * 100)}%`
                          : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
