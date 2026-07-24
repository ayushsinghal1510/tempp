import { redirect } from "next/navigation";

// Temporarily disabled — practice-only mode. Bounces to /practice, which
// bounces unauthenticated visitors on to /practice/login itself.
export default function DisabledPage() {
  redirect("/practice");
}

// ---- practice-only mode: original implementation commented out below ----
// import Link from "next/link";
// import { notFound } from "next/navigation";
// import { requireUser } from "@/lib/auth/session";
// import DashboardShell from "@/components/dashboard/DashboardShell";
// import { StatCard } from "@/components/dashboard/StatCard";
// import PoolRing from "@/components/charts/bklit/PoolRing";
// import TrendLine, { type TrendPoint } from "@/components/charts/rc/TrendLine";
// import QuotaEditor from "@/components/super/QuotaEditor";
// import { SUPER_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
// import { CalendarCheck, PiggyBank, Users } from "lucide-react";
//
// const WEEK = 7 * 24 * 60 * 60 * 1000;
// const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
//
// export const dynamic = "force-dynamic";
//
// export default async function UniversityDetail({
//   params,
// }: {
//   params: Promise<{ id: string }>;
// }) {
//   const { id } = await params;
//   const user = await requireUser(["super_admin"]);
//
//   const uni = await prisma.university.findUnique({
//     where: { id },
//     include: {
//       _count: { select: { students: true } },
//       cohorts: {
//         orderBy: { createdAt: "desc" },
//         include: { _count: { select: { cohortStudents: true } } },
//       },
//     },
//   });
//   if (!uni) notFound();
//
//   const pct =
//     uni.sessionsAllotted > 0
//       ? Math.round((uni.sessionsUsed / uni.sessionsAllotted) * 100)
//       : 0;
//   const remaining = uni.sessionsAllotted - uni.sessionsUsed;
//
//   // Usage-over-time + projection to the contracted cap.
//   const doneSessions = await prisma.session.findMany({
//     where: { status: "completed", completedAt: { not: null }, cohort: { universityId: id } },
//     select: { completedAt: true },
//     orderBy: { completedAt: "asc" },
//   });
//   const usageTrend: TrendPoint[] = [];
//   let exhaustLabel: string | null = null;
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
//       usageTrend.push({ label: fmt(new Date(start + w * WEEK)), value: cum, projected: null });
//     }
//     // project forward at the average weekly rate until we hit the cap
//     const rate = cum / (lastWeek + 1);
//     if (rate > 0 && cum < uni.sessionsAllotted) {
//       const weeksToCap = Math.ceil((uni.sessionsAllotted - cum) / rate);
//       usageTrend[usageTrend.length - 1].projected = cum; // anchor the dashed line
//       let pc = cum;
//       for (let w = 1; w <= weeksToCap; w++) {
//         pc = Math.min(uni.sessionsAllotted, pc + rate);
//         usageTrend.push({ label: fmt(new Date(start + (lastWeek + w) * WEEK)), value: null, projected: Math.round(pc) });
//       }
//       exhaustLabel = fmt(new Date(start + (lastWeek + weeksToCap) * WEEK));
//     }
//   }
//
//   return (
//     <DashboardShell user={user} nav={SUPER_NAV} title={uni.name} org="University detail">
//       <div className="space-y-6">
//         <Link href="/super/universities" className="text-sm text-muted hover:text-ink">
//           ← All universities
//         </Link>
//
//         {/* ── Pool consumption + quota editor ── */}
//         <section className="card p-6">
//           <div className="grid gap-6 md:grid-cols-[200px_1fr] md:items-center">
//             <div className="mx-auto h-[180px] w-[180px]">
//               <PoolRing
//                 used={uni.sessionsUsed}
//                 contracted={uni.sessionsAllotted}
//                 size={180}
//               />
//             </div>
//             <div>
//               <div className="flex flex-wrap items-start justify-between gap-4">
//                 <h2 className="text-lg font-semibold text-ink">Contracted pool</h2>
//                 <QuotaEditor
//                   universityId={uni.id}
//                   allotted={uni.sessionsAllotted}
//                   used={uni.sessionsUsed}
//                 />
//               </div>
//               <p className="mt-1 text-sm text-muted">
//                 {uni.name} has used{" "}
//                 <span className="font-semibold text-ink">
//                   {uni.sessionsUsed} of {uni.sessionsAllotted}
//                 </span>{" "}
//                 sessions ({pct}%). Each university carries its own pool — this is
//                 the renewal signal for this account.
//               </p>
//             </div>
//           </div>
//         </section>
//
//         {/* ── Usage over time + projection to the cap ── */}
//         {usageTrend.length > 0 && (
//           <section className="card p-6">
//             <div className="flex flex-wrap items-baseline justify-between gap-2">
//               <h3 className="font-semibold text-ink">Pool usage & projection</h3>
//               {exhaustLabel ? (
//                 <span className="text-sm text-danger">
//                   At this rate, cap reached ~{exhaustLabel}
//                 </span>
//               ) : (
//                 <span className="text-sm text-muted">Not enough usage to project yet</span>
//               )}
//             </div>
//             <p className="mt-0.5 text-xs text-muted">
//               Sessions consumed (solid) vs. the contracted cap (red line). Dashed
//               = projection at the current weekly rate.
//             </p>
//             <div className="mt-4">
//               <TrendLine
//                 data={usageTrend}
//                 yMax={Math.ceil(uni.sessionsAllotted * 1.1)}
//                 yUnit=" sessions"
//                 limit={{ value: uni.sessionsAllotted, label: `Cap ${uni.sessionsAllotted}` }}
//                 kinks={exhaustLabel ? [{ at: exhaustLabel, label: "cap" }] : undefined}
//                 hasProjection
//               />
//             </div>
//           </section>
//         )}
//
//         <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
//           <StatCard
//             label="Sessions used"
//             value={`${uni.sessionsUsed}/${uni.sessionsAllotted}`}
//             sub={`${pct}% of pool`}
//             icon={CalendarCheck}
//           />
//           <StatCard label="Remaining" value={remaining} accent icon={PiggyBank} />
//           <StatCard label="Students enrolled" value={uni._count.students} icon={Users} />
//         </section>
//
//         {/* ── Cohorts (companies) at this university ── */}
//         <section className="card overflow-hidden">
//           <div className="border-b border-line px-6 py-4">
//             <h3 className="font-semibold text-ink">Cohorts</h3>
//           </div>
//           {uni.cohorts.length === 0 ? (
//             <div className="px-6 py-8 text-sm text-muted">
//               No cohorts yet at this university.
//             </div>
//           ) : (
//             <table className="w-full text-sm">
//               <thead>
//                 <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
//                   <th className="px-6 py-2.5 font-medium">Company</th>
//                   <th className="px-6 py-2.5 font-medium">Status</th>
//                   <th className="px-6 py-2.5 font-medium">Students</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {uni.cohorts.map((c) => (
//                   <tr key={c.id} className="border-b border-line last:border-0 hover:bg-canvas">
//                     <td className="px-6 py-3 font-medium text-ink">
//                       {c.companyName}
//                     </td>
//                     <td className="px-6 py-3 text-muted">{c.status}</td>
//                     <td className="px-6 py-3 tabular-nums text-muted">
//                       {c._count.cohortStudents}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           )}
//         </section>
//       </div>
//     </DashboardShell>
//   );
// }
//
