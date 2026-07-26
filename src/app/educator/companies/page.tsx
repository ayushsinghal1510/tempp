import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import { tenantConfig } from "@/lib/tenants/config";
import { tierProfile } from "@/lib/research/tierProfiles";

export const dynamic = "force-dynamic";

export default async function EducatorCompaniesPage() {
  const user = await requireUser(["practice_admin"], "/educator/login");
  const { copy, features } = tenantConfig(user.tenant);
  const unitPlural = copy.unitPlural;
  const orgId = await requireEducatorOrgId(user.id);

  const companies = await prisma.practiceCompany.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assignments: true, rounds: true } },
    },
  });

  return (
    <DashboardShell
      user={user}
      nav={educatorNav(unitPlural)}
      title={`${copy.unitTitle}s`}
    >
      <div className="space-y-6">
        <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-semibold text-ink">Your {copy.unitPlural}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {features.research
                ? "Researched once, then reused by every student you assign."
                : "Written once, then reused by every student you assign."}
            </p>
          </div>
          <Link
            href="/educator/companies/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
          >
            + Add {copy.unitSingular}
          </Link>
        </section>

        {companies.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No {copy.unitPlural} yet. Add one — it&apos;s written once and shared
            across the whole class.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => {
              const profile = tierProfile(c.tier);
              return (
                <Link
                  key={c.id}
                  href={`/educator/companies/${c.id}`}
                  className="card space-y-2 p-5 transition hover:border-brand"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {c.companyName}
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        c.status === "published"
                          ? "bg-success-soft text-success"
                          : "bg-warning-soft text-warning"
                      }`}
                    >
                      {c.status === "published" ? "Published" : "Draft"}
                    </span>
                  </div>
                  {c.jobTitle && (
                    <p className="text-sm text-muted">{c.jobTitle}</p>
                  )}
                  {profile && (
                    <p className="text-xs text-faint">
                      {profile.label} · {profile.salaryBand}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    {c._count.assignments} assigned · {c._count.rounds} session
                    {c._count.rounds === 1 ? "" : "s"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
