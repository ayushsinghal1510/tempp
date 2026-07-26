import { requireUser } from "@/lib/auth/session";
import { getUserRoundsWithCompany } from "@/lib/practice/cachedQueries";
import PracticeHeader from "@/components/practice/PracticeHeader";
import SessionsTable, {
  type SessionRow,
} from "@/components/practice/SessionsTable";
import {
  bestWorstTopic,
  sessionDurationSeconds,
  sessionImprovement,
} from "@/lib/practice/metrics";
import { topicsFor } from "@/lib/tenants/config";

export const dynamic = "force-dynamic";

export default async function PracticeSessionsPage() {
  const user = await requireUser(["practice"], "/practice/login");
  const topics = topicsFor(user.tenant);
  const rounds = await getUserRoundsWithCompany(user.id);

  // Number sessions within their own company (or the legacy/no-company
  // bucket) in creation order, so "Session 3" stays meaningful per company
  // even though the page itself lists everything most-recent-first below.
  const seqByKey = new Map<string, number>();
  const rows: SessionRow[] = rounds
    .map((r) => {
      const key = r.companyId ?? "legacy";
      const n = (seqByKey.get(key) ?? 0) + 1;
      seqByKey.set(key, n);
      const bw = bestWorstTopic(r, topics);
      return {
        id: r.id,
        label: `Session ${n}`,
        companyId: r.companyId,
        companyName:
          r.company?.companyName ?? r.companyName ?? "General practice",
        date: r.createdAt,
        durationSeconds: sessionDurationSeconds(r),
        turnCount: r.turns.length,
        bestTopic: bw?.best ?? null,
        worstTopic: bw?.worst ?? null,
        improvement: sessionImprovement(r, topics),
        completed: r.status === "completed",
      };
    })
    .reverse();

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <section className="card p-6">
          <h1 className="text-xl font-bold text-ink">All sessions</h1>
          <p className="mt-1 text-sm text-muted">
            Every practice session you&apos;ve run, across every company.
          </p>
        </section>

        <SessionsTable sessions={rows} topics={topics} showCompanyColumn />
      </div>
    </main>
  );
}
