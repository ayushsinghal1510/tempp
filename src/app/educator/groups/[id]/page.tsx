import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { EDUCATOR_NAV } from "@/lib/nav";
import JoinCode from "@/components/educator/JoinCode";
import CohortAnalytics from "@/components/educator/CohortAnalytics";
import KpiCard from "@/components/practice/KpiCard";
import {
  groupFunnelRows,
  groupStudentRounds,
} from "@/lib/practice/educatorQueries";
import { assignmentFunnel } from "@/lib/practice/educatorMetrics";
import { DEGREE_LABEL } from "@/lib/research/expectationMatrix";

export const dynamic = "force-dynamic";

export default async function EducatorGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);

  const [group, students, funnelRows] = await Promise.all([
    prisma.practiceGroup.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                course: true,
                cgpa: true,
              },
            },
          },
        },
        assignments: {
          distinct: ["companyId"],
          include: { company: { select: { id: true, companyName: true } } },
        },
      },
    }),
    groupStudentRounds(orgId, id),
    groupFunnelRows(orgId, id),
  ]);

  // Scoped to the educator's own org — another org's group is simply absent.
  if (!group || group.orgId !== orgId) notFound();

  const funnel = assignmentFunnel(funnelRows);

  return (
    <DashboardShell user={user} nav={EDUCATOR_NAV} title={group.name}>
      <div className="space-y-6">
        <Link
          href="/educator/groups"
          className="text-sm text-muted hover:text-ink"
        >
          ← Classes
        </Link>

        <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-xl font-bold text-ink">{group.name}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {group.members.length} student
              {group.members.length === 1 ? "" : "s"} enrolled
            </p>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
              Class code
            </div>
            <JoinCode groupId={group.id} code={group.joinCode} />
          </div>
        </section>

        <CohortAnalytics
          students={students}
          funnel={funnel}
          scope="this class"
          extraKpis={
            <KpiCard
              label="Students"
              value={String(group.members.length)}
              sub={`${group.assignments.length} compan${group.assignments.length === 1 ? "y" : "ies"} assigned`}
            />
          }
        />

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Assigned companies</h3>
          {group.assignments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Nothing assigned yet — assign a company from{" "}
              <Link href="/educator/companies" className="text-brand hover:underline">
                Companies
              </Link>
              .
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {group.assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/educator/companies/${a.company.id}`}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink transition hover:border-brand hover:text-brand"
                >
                  {a.company.companyName}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Students</h3>
          {group.members.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Nobody has joined yet. Share the class code above.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Course</th>
                    <th className="pb-2 font-medium">CGPA</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m) => (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="py-2.5">
                        <Link
                          href={`/educator/students/${m.user.id}`}
                          className="font-medium text-ink hover:text-brand"
                        >
                          {m.user.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-muted">{m.user.email}</td>
                      <td className="py-2.5 text-muted">
                        {m.user.course ? DEGREE_LABEL[m.user.course] : "—"}
                      </td>
                      <td className="py-2.5 text-muted">
                        {m.user.cgpa ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
