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
// import ActivityLines from "@/components/charts/bklit/ActivityLines";
// import { SUPER_NAV } from "@/lib/nav";
// import { inr } from "@/lib/format";
// import { getSuperDashboard } from "@/lib/queries/super";
// import { Activity, School, ClipboardCheck, IndianRupee } from "lucide-react";
//
// export const dynamic = "force-dynamic";
//
// const PALETTE = [
//   "var(--chart-1)",
//   "var(--chart-2)",
//   "var(--chart-4)",
//   "var(--chart-3)",
//   "var(--chart-5)",
// ];
//
// export default async function SuperDashboard() {
//   const user = await requireUser(["super_admin"]);
//   const data = await getSuperDashboard();
//   const activitySeries = data.seriesNames.map((name, i) => ({
//     key: name,
//     label: name,
//     color: PALETTE[i % PALETTE.length],
//   }));
//
//   return (
//     <DashboardShell user={user} nav={SUPER_NAV} title="Platform overview" org="All universities">
//       <div className="space-y-6">
//         {/* KPI cards — real counts from the database. */}
//         <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
//           <StatCard label="Sessions delivered" value={data.kpis.totalSessionsDone.toLocaleString("en-IN")} icon={Activity} />
//           <StatCard label="Universities" value={data.universities.length} icon={School} />
//           <StatCard label="Test interviews done" value={data.kpis.totalInterviewsDone.toLocaleString("en-IN")} icon={ClipboardCheck} />
//           <StatCard label="Total spend" value={inr(data.kpis.totalSpend)} accent icon={IndianRupee} />
//         </section>
//
//         {/* ── DOMINANT: which university has gone quiet ── */}
//         <section className="card p-6">
//           <h2 className="text-lg font-semibold text-ink">Which university has gone quiet?</h2>
//           <p className="mt-1 text-sm text-muted">
//             Completed sessions over time, per university. A line trending to the
//             floor is an early churn warning — pool usage is tracked on each
//             university&apos;s own page.
//           </p>
//           <div className="mt-4">
//             {data.usageByDay.length > 0 ? (
//               <ActivityLines data={data.usageByDay} series={activitySeries} />
//             ) : (
//               <p className="py-10 text-center text-sm text-muted">
//                 No completed sessions yet.
//               </p>
//             )}
//           </div>
//         </section>
//
//         {/* Universities table */}
//         <section className="card overflow-hidden">
//           <div className="border-b border-line px-6 py-4">
//             <h3 className="font-semibold text-ink">Universities</h3>
//             <p className="mt-0.5 text-xs text-muted">
//               Consumption is the renewal signal. Average improvement can go
//               negative — and does.
//             </p>
//           </div>
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm">
//               <thead>
//                 <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
//                   <th className="px-6 py-2.5 font-medium">University</th>
//                   <th className="px-6 py-2.5 font-medium">Pool consumed</th>
//                   <th className="px-6 py-2.5 font-medium">Avg improvement</th>
//                   <th className="px-6 py-2.5 font-medium">Spend</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {data.universities.map((u) => {
//                   const pct = u.allotted > 0 ? Math.round((u.used / u.allotted) * 100) : 0;
//                   const imp = u.avgImprovement ?? 0;
//                   const up = imp >= 0;
//                   return (
//                     <tr key={u.id} className="border-b border-line last:border-0 hover:bg-canvas">
//                       <td className="px-6 py-3 font-medium">
//                         <Link href={`/super/universities/${u.id}`} className="text-brand hover:underline">
//                           {u.name}
//                         </Link>
//                       </td>
//                       <td className="px-6 py-3">
//                         <div className="flex items-center gap-3">
//                           <div className="h-2 w-32 overflow-hidden rounded-full bg-canvas">
//                             <div
//                               className="h-full rounded-full"
//                               style={{
//                                 width: `${pct}%`,
//                                 background: pct >= 70 ? "var(--danger)" : pct >= 50 ? "var(--warning)" : "var(--brand)",
//                               }}
//                             />
//                           </div>
//                           <span className="tabular-nums text-xs font-medium text-ink">{pct}%</span>
//                           <span className="tabular-nums text-xs text-muted">
//                             {u.used}/{u.allotted}
//                           </span>
//                         </div>
//                       </td>
//                       <td className={`px-6 py-3 font-medium tabular-nums ${up ? "text-success" : "text-danger"}`}>
//                         {up ? "▲ +" : "▼ "}
//                         {imp.toFixed(1)}
//                       </td>
//                       <td className="px-6 py-3 tabular-nums">{inr(u.spend)}</td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         </section>
//       </div>
//     </DashboardShell>
//   );
// }
//
