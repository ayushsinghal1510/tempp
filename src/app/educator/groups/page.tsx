import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import { tenantConfig } from "@/lib/tenants/config";
import NewGroupForm from "@/components/educator/NewGroupForm";
import JoinCode from "@/components/educator/JoinCode";

export const dynamic = "force-dynamic";

export default async function EducatorGroupsPage() {
  const user = await requireUser(["practice_admin"], "/educator/login");
  const unitPlural = tenantConfig(user.tenant).copy.unitPlural;
  const orgId = await requireEducatorOrgId(user.id);

  const groups = await prisma.practiceGroup.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, assignments: true } },
    },
  });

  return (
    <DashboardShell user={user} nav={educatorNav(unitPlural)} title="Classes">
      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="font-semibold text-ink">Create a class</h2>
          <p className="mt-0.5 text-sm text-muted">
            Students join with the code — they keep their own account, course
            and CGPA.
          </p>
          <div className="mt-4">
            <NewGroupForm />
          </div>
        </section>

        {groups.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No classes yet. Create one above, then share its code with your
            students.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <section key={g.id} className="card space-y-3 p-5">
                <Link
                  href={`/educator/groups/${g.id}`}
                  className="block font-semibold text-ink hover:text-brand"
                >
                  {g.name}
                </Link>
                <div className="text-xs text-muted">
                  {g._count.members} student
                  {g._count.members === 1 ? "" : "s"} ·{" "}
                  {g._count.assignments} assignment
                  {g._count.assignments === 1 ? "" : "s"}
                </div>
                <JoinCode groupId={g.id} code={g.joinCode} />
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
