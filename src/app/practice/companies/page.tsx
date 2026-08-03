import { requireUser } from "@/lib/auth/session";
import { getUserCompaniesWithRounds } from "@/lib/practice/cachedQueries";
import PracticeHeader from "@/components/practice/PracticeHeader";
import CompaniesTable, {
  type CompanyRow,
} from "@/components/practice/CompaniesTable";
import JoinClassForm from "@/components/practice/JoinClassForm";
import { aggregate } from "@/lib/practice/metrics";
import { tenantConfig } from "@/lib/tenants/config";
import { deadlineState } from "@/lib/practice/deadline";
import CompanyForm from "./CompanyForm";

export const dynamic = "force-dynamic";

export default async function PracticeCompaniesPage() {
  const user = await requireUser(["practice"], "/practice/login");
  const { topics, features, copy } = tenantConfig(user.tenant);
  const companies = await getUserCompaniesWithRounds(user.id);

  // One instant for the whole list, so two rows with the same due date can
  // never disagree about whether it has passed.
  const now = new Date();

  // Three tenants, so a two-branch ternary can only ever be wrong for one of
  // them — this used to read "Your scenarios" to a cus user. Keyed off the
  // feature that actually decides where units come from, not the tenant name.
  const blurb = features.company
    ? `Register a ${copy.unitSingular} once, then run as many ${copy.sessionNoun}s against it as you like. Anything your educator assigns shows up here too.`
    : features.assignments
      ? `Every ${copy.unitSingular} your educator has assigned you. Run each one as many times as you like — it plays out differently every time.`
      : `Every ${copy.unitSingular} published to your organisation. Run each one as many times as you like.`;

  const rows: CompanyRow[] = companies.map((c) => {
    const stats = aggregate(c.rounds, topics);
    const assignment = c.assignments[0];
    const deadline = assignment ? deadlineState(assignment, now) : null;
    return {
      id: c.id,
      companyName: c.companyName,
      jobTitle: c.jobTitle,
      tier: c.tier,
      totalSessions: stats.totalSessions,
      avgImprovement: stats.avgImprovement,
      bestTopic: stats.bestTopic,
      worstTopic: stats.worstTopic,
      adoptionRate: stats.adoptionRate,
      assigned: assignment
        ? {
            mode: assignment.mode,
            dueDate: assignment.dueDate
              ? new Date(assignment.dueDate).toISOString()
              : null,
            // Resolved on the server so a student can't reopen their own
            // assignment by changing the clock on their machine.
            deadline: deadline!.status,
            canStart: deadline!.canStart,
          }
        : null,
    };
  });

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} tenant={user.tenant} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <section className="card p-6">
          <h1 className="text-xl font-bold text-ink">Your {copy.unitPlural}</h1>
          <p className="mt-1 text-sm text-muted">{blurb}</p>
          {features.company && (
            <div className="mt-4 max-w-md">
              <CompanyForm />
            </div>
          )}
          {/* No class code on autoEnroll tenants — signup already put them in
              the one org their admin publishes to. */}
          {!features.autoEnroll && (
            <div className="mt-4">
              <JoinClassForm />
            </div>
          )}
        </section>

        <CompaniesTable companies={rows} topics={topics} copy={copy} />
      </div>
    </main>
  );
}
