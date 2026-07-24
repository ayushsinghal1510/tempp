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
// import { StatCard } from "@/components/dashboard/StatCard";
// import TrendLine, { type TrendPoint } from "@/components/charts/rc/TrendLine";
// import { ADMIN_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
// import { Users, Building2, ClipboardCheck, Gauge } from "lucide-react";
//
// export const dynamic = "force-dynamic";
//
// const WEEK = 7 * 24 * 60 * 60 * 1000;
// const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
//
// const TIER_LABEL: Record<string, string> = {
//   tier_1: "Tier 1",
//   tier_2: "Tier 2",
//   tier_3: "Tier 3",
// };
//
// export default async function AdminDashboard() {
//   const user = await requireUser(["admin"]);
//
//   const uni = user.universityId
//     ? await prisma.university.findUnique({ where: { id: user.universityId } })
//     : null;
//
//   // Every cohort this placement office is running, with the data the admin is
//   // allowed to see. NOTE: only TEST rounds are visible to the admin — coaching
//   // rounds stay private to each student.
//   const cohorts = user.universityId
//     ? await prisma.cohort.findMany({
//         where: { universityId: user.universityId },
//         orderBy: { createdAt: "desc" },
//         include: {
//           vacancies: true,
//           _count: { select: { cohortStudents: true } },
//           sessions: {
//             include: {
//               rounds: { where: { type: "test" }, select: { status: true, overallScore: true } },
//             },
//           },
//         },
//       })
//     : [];
//
//   // Per-cohort roll-ups (test rounds only).
//   const rows = cohorts.map((c) => {
//     const testRounds = c.sessions.flatMap((s) => s.rounds);
//     const completed = testRounds.filter((r) => r.status === "completed");
//     const scored = completed.filter((r) => r.overallScore != null);
//     const avg =
//       scored.length > 0
//         ? scored.reduce((a, r) => a + (r.overallScore ?? 0), 0) / scored.length
//         : null;
//     return {
//       id: c.id,
//       companyName: c.companyName,
//       status: c.status,
//       vacancy: c.vacancies[0],
//       students: c._count.cohortStudents,
//       testTotal: testRounds.length,
//       testCompleted: completed.length,
//       avgScore: avg,
//     };
//   });
//
//   // Sessions completed over time (cumulative) — the delivery trend.
//   const doneSessions = user.universityId
//     ? await prisma.session.findMany({
//         where: {
//           status: "completed",
//           completedAt: { not: null },
//           cohort: { universityId: user.universityId },
//         },
//         select: { completedAt: true },
//         orderBy: { completedAt: "asc" },
//       })
//     : [];
//   const sessionsTrend: TrendPoint[] = [];
//   if (doneSessions.length > 0) {
//     const start = doneSessions[0].completedAt!.getTime();
//     const perWeek = new Map<number, number>();
//     for (const s of doneSessions) {
//       const w = Math.floor((s.completedAt!.getTime() - start) / WEEK);
//       perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
//     }
//     const lastWeek = Math.max(...perWeek.keys());
//     let cum = 0;
//     for (let w = 0; w <= lastWeek; w++) {
//       cum += perWeek.get(w) ?? 0;
//       sessionsTrend.push({ label: fmtDay(new Date(start + w * WEEK)), value: cum });
//     }
//   }
//
//   const totalStudents = user.universityId
//     ? await prisma.student.count({ where: { universityId: user.universityId } })
//     : 0;
//   const activeCohorts = rows.filter((r) => r.status === "active").length;
//   const allScored = rows.flatMap((r) =>
//     r.avgScore != null ? [{ avg: r.avgScore, n: r.testCompleted }] : [],
//   );
//   const cohortAvg =
//     allScored.length > 0
//       ? allScored.reduce((a, s) => a + s.avg, 0) / allScored.length
//       : null;
//   const testsDone = rows.reduce((a, r) => a + r.testCompleted, 0);
//
//   return (
//     <DashboardShell
//       user={user}
//       nav={ADMIN_NAV}
//       title="Placement dashboard"
//       org={uni?.name ?? "Placement office"}
//     >
//       <div className="space-y-6">
//         <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
//           <StatCard label="Students" value={totalStudents} icon={Users} />
//           <StatCard label="Active cohorts" value={activeCohorts} icon={Building2} />
//           <StatCard label="Test rounds completed" value={testsDone} icon={ClipboardCheck} />
//           <StatCard
//             label="Avg test score"
//             value={
//               cohortAvg != null ? (
//                 <>
//                   {cohortAvg.toFixed(1)}
//                   <span className="text-lg text-faint">/10</span>
//                 </>
//               ) : (
//                 "—"
//               )
//             }
//             accent
//             icon={Gauge}
//           />
//         </section>
//
//         {/* ── Sessions completed over time ── */}
//         <section className="card p-6">
//           <h3 className="font-semibold text-ink">Sessions completed</h3>
//           <p className="mt-0.5 text-sm text-muted">
//             Cumulative interview sessions your students have finished — your
//             delivery trend across all cohorts.
//           </p>
//           {sessionsTrend.length === 0 ? (
//             <p className="py-10 text-center text-sm text-muted">
//               No completed sessions yet.
//             </p>
//           ) : (
//             <div className="mt-4">
//               <TrendLine data={sessionsTrend} yUnit=" sessions" />
//             </div>
//           )}
//         </section>
//
//         <section className="card overflow-hidden">
//           <div className="flex items-center justify-between border-b border-line px-6 py-4">
//             <div>
//               <h3 className="font-semibold text-ink">Cohorts</h3>
//               <p className="mt-0.5 text-xs text-muted">
//                 One per company drive. Click a cohort to open it.
//               </p>
//             </div>
//             <Link
//               href="/admin/cohorts/new"
//               className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
//             >
//               + Start a cohort
//             </Link>
//           </div>
//
//           {rows.length === 0 ? (
//             <div className="p-10 text-center text-muted">
//               No cohorts yet — start your first one.
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-sm">
//                 <thead>
//                   <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
//                     <th className="px-6 py-2.5 font-medium">Company</th>
//                     <th className="px-6 py-2.5 font-medium">Tier</th>
//                     <th className="px-6 py-2.5 font-medium">Students</th>
//                     <th className="px-6 py-2.5 font-medium">Test rounds done</th>
//                     <th className="px-6 py-2.5 font-medium">Avg test score</th>
//                     <th className="px-6 py-2.5 font-medium">Status</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {rows.map((r) => (
//                     <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
//                       <td className="px-6 py-3 font-medium">
//                         <Link
//                           href={`/admin/cohorts/${r.id}`}
//                           className="text-brand hover:underline"
//                         >
//                           {r.companyName}
//                         </Link>
//                         {r.vacancy?.jobTitle && (
//                           <div className="text-xs font-normal text-muted">
//                             {r.vacancy.jobTitle}
//                           </div>
//                         )}
//                       </td>
//                       <td className="px-6 py-3 text-muted">
//                         {r.vacancy?.tier ? TIER_LABEL[r.vacancy.tier] : "—"}
//                         {r.vacancy?.salaryLpa != null && (
//                           <span className="text-xs"> · {r.vacancy.salaryLpa} LPA</span>
//                         )}
//                       </td>
//                       <td className="px-6 py-3 text-muted">{r.students}</td>
//                       <td className="px-6 py-3 tabular-nums text-muted">
//                         {r.testCompleted}/{r.testTotal}
//                       </td>
//                       <td className="px-6 py-3 tabular-nums">
//                         {r.avgScore != null ? `${r.avgScore.toFixed(1)}/10` : "—"}
//                       </td>
//                       <td className="px-6 py-3">
//                         <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium capitalize text-success">
//                           {r.status}
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </section>
//       </div>
//     </DashboardShell>
//   );
// }
//
