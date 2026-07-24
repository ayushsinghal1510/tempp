import { redirect } from "next/navigation";

// Temporarily disabled — practice-only mode. Bounces to /practice, which
// bounces unauthenticated visitors on to /practice/login itself.
export default function DisabledPage() {
  redirect("/practice");
}

// ---- practice-only mode: original implementation commented out below ----
// import Link from "next/link";
// import { requireUser } from "@/lib/auth/session";
// import DashboardShell from "@/components/dashboard/DashboardShell";
// import { STUDENT_NAV } from "@/lib/nav";
// import { getStudentCohorts, upcomingCohorts } from "@/lib/queries/student";
//
// export const dynamic = "force-dynamic";
//
// const TIER_LABEL: Record<string, string> = {
//   tier_1: "Tier 1",
//   tier_2: "Tier 2",
//   tier_3: "Tier 3",
// };
//
// function whenLabel(d: Date | null): string {
//   if (!d) return "Date TBD";
//   const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
//   if (days < 0) return "done";
//   if (days === 0) return "today";
//   return `in ${days}d`;
// }
//
// export default async function StudentCompanies() {
//   const user = await requireUser(["student"]);
//   const cohorts = upcomingCohorts(await getStudentCohorts(user.id));
//
//   return (
//     <DashboardShell user={user} nav={STUDENT_NAV} title="Companies" showPrivacyNote>
//       <div className="space-y-4">
//         <p className="text-sm text-muted">
//           One session per company — 3 coaching rounds (private to you) and 2 test
//           rounds. Each is scored on the company&apos;s own rubric.
//         </p>
//         {cohorts.length === 0 ? (
//           <div className="card p-10 text-center text-muted">
//             No companies yet — your placement office will line them up.
//           </div>
//         ) : (
//           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//             {cohorts.map((c) => (
//               <Link
//                 key={c.cohortId}
//                 href={`/student/companies/${c.cohortId}`}
//                 className="card p-5 transition hover:border-brand/40"
//               >
//                 <div className="flex items-center justify-between">
//                   <div className="text-lg font-semibold text-ink">
//                     {c.companyName}
//                   </div>
//                   <span className="text-xs text-muted">{whenLabel(c.driveDate)}</span>
//                 </div>
//                 <div className="mt-0.5 text-sm text-muted">
//                   {c.jobTitle ?? "Role"}
//                   {c.tier ? ` · ${TIER_LABEL[c.tier]}` : ""}
//                 </div>
//                 <div className="mt-4 flex items-baseline gap-1">
//                   <span className="text-3xl font-bold tabular-nums text-brand">
//                     {c.bestTestScore != null ? c.bestTestScore.toFixed(1) : "—"}
//                   </span>
//                   <span className="text-sm text-muted">/10 best test round</span>
//                 </div>
//                 <div className="mt-3 flex items-center justify-between">
//                   <span className="text-sm text-brand">Open prep →</span>
//                   {c.pendingCount > 0 && (
//                     <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
//                       {c.pendingCount} to give
//                     </span>
//                   )}
//                 </div>
//               </Link>
//             ))}
//           </div>
//         )}
//       </div>
//     </DashboardShell>
//   );
// }
//
