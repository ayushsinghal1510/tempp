import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import JoinCode from "@/components/educator/JoinCode";
import CohortAnalytics from "@/components/educator/CohortAnalytics";
import KpiCard from "@/components/practice/KpiCard";
import {
  groupFunnelRows,
  groupStudentRounds,
} from "@/lib/practice/educatorQueries";
import {
  assignmentFunnel,
  sessionListRows,
} from "@/lib/practice/educatorMetrics";
import { tenantConfig } from "@/lib/tenants/config";
import { DEGREE_LABEL } from "@/lib/research/expectationMatrix";
import ClickableRow from "@/components/ui/ClickableRow";
import ReadinessToggle from "@/components/educator/ReadinessToggle";
import SessionsList from "@/components/educator/SessionsList";

export const dynamic = "force-dynamic";

export default async function EducatorGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);
  const tenant = tenantConfig(user.tenant);
  const unitPlural = tenant.copy.unitPlural;

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
                readiness: true,
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

  const funnel = assignmentFunnel(funnelRows, tenant.funnelStages);
  // groupStudentRounds is scoped by class MEMBERSHIP, not by assignment, so
  // this includes a member's sessions on a company they hold individually —
  // which is the point: this is what the class has been doing, not what it
  // was told to do.
  const sessions = sessionListRows(students, tenant.topics);

  return (
    <DashboardShell user={user} nav={educatorNav(unitPlural)} title={group.name}>
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
          tenant={tenant}
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
                    <th className="pb-2 font-medium">Readiness</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Course</th>
                    <th className="pb-2 font-medium">CGPA</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m) => (
                    <ClickableRow
                      key={m.id}
                      href={`/educator/students/${m.user.id}`}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-2.5">
                        <Link
                          href={`/educator/students/${m.user.id}`}
                          className="font-medium text-ink hover:text-brand"
                        >
                          {m.user.name}
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <ReadinessToggle
                          userId={m.user.id}
                          readiness={m.user.readiness}
                        />
                      </td>
                      <td className="py-2.5 text-muted">{m.user.email}</td>
                      <td className="py-2.5 text-muted">
                        {m.user.course ? DEGREE_LABEL[m.user.course] : "—"}
                      </td>
                      <td className="py-2.5 text-muted">
                        {m.user.cgpa ?? "—"}
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* The class's actual output, newest first. A class is the one place
            where a session row is genuinely (someone, something) — the same
            student appears against several companies and the same company
            against several students — so unlike the company and student pages
            this list names BOTH, and neither column is redundant with the
            heading above it. */}
        <section className="card p-6">
          <h3 className="font-semibold text-ink">Sessions</h3>
          <p className="mt-0.5 text-sm text-muted">
            Every session this class has run, newest first — who ran it and
            what they ran it against.
          </p>
          <div className="mt-4">
            <SessionsList
              rows={sessions}
              unitTitle={tenant.copy.unitTitle}
              emptyMessage="Nobody in this class has run a session yet."
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
