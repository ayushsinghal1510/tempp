import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import { tierProfile } from "@/lib/research/tierProfiles";
import type { CompanyResearch } from "@/lib/research/companyResearch";
import ResearchEditor from "@/components/educator/ResearchEditor";
import ScenarioEditor from "@/components/educator/ScenarioEditor";
import WorkflowEditor from "@/components/educator/WorkflowEditor";
import { normaliseWorkflow } from "@/lib/voice/workflowCustoms";
import type { ClinicalScenario } from "@/lib/research/scenarioGeneration";
import PublishToggle from "@/components/educator/PublishToggle";
import AssignPanel from "@/components/educator/AssignPanel";
import { deadlineState } from "@/lib/practice/deadline";
import CohortAnalytics from "@/components/educator/CohortAnalytics";
import KpiCard from "@/components/practice/KpiCard";
import {
  orgFunnelRows,
  orgStudentRounds,
} from "@/lib/practice/educatorQueries";
import { assignmentFunnel } from "@/lib/practice/educatorMetrics";
import { tenantConfig } from "@/lib/tenants/config";

export const dynamic = "force-dynamic";

export default async function EducatorCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);
  const tenant = tenantConfig(user.tenant);

  const [company, groups, students, funnelRows, members] = await Promise.all([
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
    // How many people a workflow edit lands on — org membership, not
    // assignments, since a workflow reaches everyone with no assigning step.
    prisma.practiceMember.findMany({
      where: { group: { orgId } },
      select: { userId: true },
    }),
  ]);
  const orgUserCount = new Set(members.map((m) => m.userId)).size;

  if (!company || company.orgId !== orgId) notFound();

  const funnel = assignmentFunnel(funnelRows, tenant.funnelStages);

  // Completed rounds per student on this company, from the data already
  // loaded above — no extra query. "Completed" and not merely started, because
  // a round abandoned on the connect screen is not a session anyone did.
  const now = new Date();
  const sessionsByUser = new Map(
    students.map((s) => [
      s.userId,
      s.rounds.filter((r) => r.status === "completed").length,
    ]),
  );

  const profile = tierProfile(company.tier);
  const research = company.companyResearch as CompanyResearch | null;
  const isScenario = company.kind === "scenario";
  const scenario = isScenario
    ? (company.scenario as ClinicalScenario | null)
    : null;
  const isWorkflow = company.kind === "workflow";
  const workflow = isWorkflow ? normaliseWorkflow(company.workflow) : null;

  return (
    <DashboardShell
      user={user}
      nav={educatorNav(tenant.copy.unitPlural)}
      title={company.companyName}
    >
      <div className="space-y-6">
        <Link
          href="/educator/companies"
          className="text-sm text-muted hover:text-ink"
        >
          ← {tenant.copy.unitTitle}s
        </Link>

        <section className="card flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h2 className="text-xl font-bold text-ink">{company.companyName}</h2>
            {company.jobTitle && (
              <p className="mt-0.5 text-sm text-muted">{company.jobTitle}</p>
            )}
            {profile && !isScenario && (
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

        {tenant.features.scoring && (
        <CohortAnalytics
          students={students}
          funnel={funnel}
          tenant={tenant}
          scope="this company"
          extraKpis={
            <KpiCard
              label="Assigned"
              value={String(company.assignments.length)}
              sub={`${funnel.find((f) => f.key === "started")?.value ?? 0} started`}
            />
          }
        />
        )}

        <section className="card p-6">
          <h3 className="font-semibold text-ink">
            {isWorkflow
              ? "Greeting & prompt"
              : isScenario
                ? "The patient"
                : "Interview brief"}
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {isWorkflow
              ? "This is the whole agent. Saving takes effect on the next session everyone runs — there is no publish step and nothing to assign."
              : isScenario
                ? "Generated from your brief. Edit anything that doesn't ring true — this is exactly who your students will be talking to."
                : "Generated from a live web search. Edit anything that looks wrong — this is what your students read, and what shapes the interviewer."}
          </p>
          <div className="mt-5">
            {isWorkflow && workflow ? (
              <WorkflowEditor
                companyId={company.id}
                workflow={workflow}
                userCount={orgUserCount}
              />
            ) : isScenario ? (
              <ScenarioEditor companyId={company.id} scenario={scenario} />
            ) : (
              <ResearchEditor companyId={company.id} research={research} />
            )}
          </div>
        </section>

        {tenant.features.assignments ? (
        <AssignPanel
          companyId={company.id}
          groups={groups.map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g._count.members,
          }))}
          assignments={company.assignments.map((a) => {
            const done = sessionsByUser.get(a.user.id) ?? 0;
            const state = deadlineState(a, now);
            return {
              id: a.id,
              userId: a.user.id,
              userName: a.user.name,
              userEmail: a.user.email,
              groupId: a.group?.id ?? null,
              groupName: a.group?.name ?? null,
              mode: a.mode,
              dueDate: a.dueDate ? a.dueDate.toISOString() : null,
              completedSessions: done,
              minSessions: a.minSessions,
              deadline: state.status,
            };
          })}
        />
        ) : (
          <section className="card p-6">
            <h3 className="font-semibold text-ink">Who gets this</h3>
            <p className="mt-1 text-sm text-muted">
              Everyone in your organisation — {orgUserCount}{" "}
              {orgUserCount === 1 ? "person" : "people"} right now. There is
              nothing to assign: whatever you save above is what they all get on
              their next session.
            </p>
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
