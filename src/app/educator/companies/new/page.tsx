import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { educatorNav } from "@/lib/nav";
import OrgCompanyForm from "@/components/educator/OrgCompanyForm";
import OrgScenarioForm from "@/components/educator/OrgScenarioForm";
import OrgWorkflowForm from "@/components/educator/OrgWorkflowForm";
import { tenantConfig } from "@/lib/tenants/config";

export const dynamic = "force-dynamic";

export default async function NewOrgCompanyPage() {
  const user = await requireUser(["practice_admin"], "/educator/login");
  const unitPlural = tenantConfig(user.tenant).copy.unitPlural;
  await requireEducatorOrgId(user.id);
  const { features, copy } = tenantConfig(user.tenant);

  return (
    <DashboardShell
      user={user}
      nav={educatorNav(unitPlural)}
      title={`Add ${copy.unitSingular}`}
    >
      <div className="max-w-2xl space-y-6">
        <Link
          href="/educator/companies"
          className="text-sm text-muted hover:text-ink"
        >
          ← {copy.unitTitle}s
        </Link>

        <section className="card p-6">
          <h2 className="font-semibold text-ink">
            Add a {copy.unitSingular}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {features.research
              ? "We'll research how this company actually interviews — that runs once here, not once per student. You review and edit the brief before publishing it to your class."
              : features.workflow
                ? "Name it, then write the greeting and the prompt on the next screen. Everyone in your organisation gets it straight away — there's no assigning and no publish step."
                : "Describe the patient in a line and we'll write the full case — background, how they feel, what they won't tell you unless you ask well. You review and edit it before publishing to your class."}
          </p>
          <div className="mt-5">
            {features.workflow ? (
              <OrgWorkflowForm />
            ) : features.scenario ? (
              <OrgScenarioForm />
            ) : (
              <OrgCompanyForm />
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
