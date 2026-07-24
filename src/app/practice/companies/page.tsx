import { requireUser } from "@/lib/auth/session";
import { getUserCompaniesWithRounds } from "@/lib/practice/cachedQueries";
import PracticeHeader from "@/components/practice/PracticeHeader";
import CompaniesTable, {
  type CompanyRow,
} from "@/components/practice/CompaniesTable";
import { aggregate } from "@/lib/practice/metrics";
import CompanyForm from "./CompanyForm";

export const dynamic = "force-dynamic";

export default async function PracticeCompaniesPage() {
  const user = await requireUser(["practice"], "/practice/login");
  const companies = await getUserCompaniesWithRounds(user.id);

  const rows: CompanyRow[] = companies.map((c) => {
    const stats = aggregate(c.rounds);
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
    };
  });

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <section className="card p-6">
          <h1 className="text-xl font-bold text-ink">Your companies</h1>
          <p className="mt-1 text-sm text-muted">
            Register a company once, then run as many practice sessions
            against it as you like.
          </p>
          <div className="mt-4 max-w-md">
            <CompanyForm />
          </div>
        </section>

        <CompaniesTable companies={rows} />
      </div>
    </main>
  );
}
