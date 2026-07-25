import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { EDUCATOR_NAV } from "@/lib/nav";
import OrgCompanyForm from "@/components/educator/OrgCompanyForm";

export const dynamic = "force-dynamic";

export default async function NewOrgCompanyPage() {
  const user = await requireUser(["practice_admin"], "/educator/login");
  await requireEducatorOrgId(user.id);

  return (
    <DashboardShell user={user} nav={EDUCATOR_NAV} title="Add company">
      <div className="max-w-2xl space-y-6">
        <Link
          href="/educator/companies"
          className="text-sm text-muted hover:text-ink"
        >
          ← Companies
        </Link>

        <section className="card p-6">
          <h2 className="font-semibold text-ink">Add a company</h2>
          <p className="mt-1 text-sm text-muted">
            We&apos;ll research how this company actually interviews — that runs
            once here, not once per student. You review and edit the brief
            before publishing it to your class.
          </p>
          <div className="mt-5">
            <OrgCompanyForm />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
