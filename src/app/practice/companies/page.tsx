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
      <PracticeHeader userName={user.name} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <section className="card p-6">
          <h1 className="text-xl font-bold text-ink">
            {features.company ? "Your companies" : "Your scenarios"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {features.company
              ? "Register a company once, then run as many practice sessions against it as you like. Companies your educator assigns show up here too."
              : `Every ${copy.sessionNoun} your educator has assigned you. Run each one as many times as you like — the patient responds differently every time.`}
          </p>
          {features.company && (
            <div className="mt-4 max-w-md">
              <CompanyForm />
            </div>
          )}
          <div className="mt-4">
            <JoinClassForm />
          </div>
        </section>

        <CompaniesTable companies={rows} topics={topics} copy={copy} />
      </div>
    </main>
  );
}
