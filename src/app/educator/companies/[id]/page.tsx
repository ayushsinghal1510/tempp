import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { EDUCATOR_NAV } from "@/lib/nav";
import { tierProfile } from "@/lib/research/tierProfiles";
import type { CompanyResearch } from "@/lib/research/companyResearch";
import ResearchEditor from "@/components/educator/ResearchEditor";
import PublishToggle from "@/components/educator/PublishToggle";
import AssignPanel from "@/components/educator/AssignPanel";
import CohortAnalytics from "@/components/educator/CohortAnalytics";
import KpiCard from "@/components/practice/KpiCard";
import {
  orgFunnelRows,
  orgStudentRounds,
} from "@/lib/practice/educatorQueries";
import { assignmentFunnel } from "@/lib/practice/educatorMetrics";

export const dynamic = "force-dynamic";

export default async function EducatorCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);

  const [company, groups, students, funnelRows] = await Promise.all([
    prisma.practiceCompany.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            group: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.practiceGroup.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    // Both scoped to this one company — the org-wide versions with a companyId
    // filter, so the per-company read and the dashboard can't disagree.
    orgStudentRounds(orgId, id),
    orgFunnelRows(orgId, id),
  ]);

  if (!company || company.orgId !== orgId) notFound();

  const funnel = assignmentFunnel(funnelRows);

  const profile = tierProfile(company.tier);
  const research = company.companyResearch as CompanyResearch | null;

  return (
    <DashboardShell user={user} nav={EDUCATOR_NAV} title={company.companyName}>
      <div className="space-y-6">
        <Link
          href="/educator/companies"
          className="text-sm text-muted hover:text-ink"
        >
          ← Companies
        </Link>

        <section className="card flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-xl font-bold text-ink">{company.companyName}</h2>
            {company.jobTitle && (
              <p className="mt-0.5 text-sm text-muted">{company.jobTitle}</p>
            )}
            {profile && (
              <span className="mt-2 inline-block rounded-lg border border-line px-3 py-1 text-xs font-semibold text-muted">
                {profile.label} · {profile.salaryBand}
              </span>
            )}
          </div>
          <PublishToggle
            companyId={company.id}
            published={company.status === "published"}
            assignedCount={company.assignments.length}
          />
        </section>

        {company.status === "draft" && (
          <div className="card border-warning/40 bg-warning-soft p-4 text-sm text-warning">
            This is a draft — students you assign it to can&apos;t see it yet.
            Review the brief below, then publish.
          </div>
        )}

        <CohortAnalytics
          students={students}
          funnel={funnel}
          scope="this company"
          extraKpis={
            <KpiCard
              label="Assigned"
              value={String(company.assignments.length)}
              sub={`${funnel.started} started`}
            />
          }
        />

        <section className="card p-6">
          <h3 className="font-semibold text-ink">Interview brief</h3>
          <p className="mt-0.5 text-sm text-muted">
            Generated from a live web search. Edit anything that looks wrong —
            this is what your students read, and what shapes the interviewer.
          </p>
          <div className="mt-5">
            <ResearchEditor companyId={company.id} research={research} />
          </div>
        </section>

        <AssignPanel
          companyId={company.id}
          groups={groups.map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g._count.members,
          }))}
          assignments={company.assignments.map((a) => ({
            id: a.id,
            userId: a.user.id,
            userName: a.user.name,
            userEmail: a.user.email,
            groupId: a.group?.id ?? null,
            groupName: a.group?.name ?? null,
            mode: a.mode,
            dueDate: a.dueDate ? a.dueDate.toISOString() : null,
          }))}
        />
      </div>
    </DashboardShell>
  );
}
