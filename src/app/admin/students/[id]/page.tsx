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
// import TrendLine, { type TrendPoint } from "@/components/charts/rc/TrendLine";
// import SkillRadar from "@/components/charts/bklit/SkillRadar";
// import SkillBars from "@/components/charts/bklit/SkillBars";
// import { toSkillBars } from "@/lib/skills";
// import { ADMIN_NAV } from "@/lib/nav";
// import { getAdminStudentDetail } from "@/lib/queries/admin";
// import { GraduationCap, Trophy, TrendingUp } from "lucide-react";
//
// export const dynamic = "force-dynamic";
//
// export default async function AdminStudentDetail({
//   params,
// }: {
//   params: Promise<{ id: string }>;
// }) {
//   const { id } = await params;
//   const user = await requireUser(["admin"]);
//   const detail = await getAdminStudentDetail(id, user.universityId!);
//   if (!detail) notFound();
//
//   const { student, scoreGrowth, radar, whatWentWell, areasToImprove } = detail;
//   const best = scoreGrowth.length
//     ? Math.max(...scoreGrowth.map((p) => p.score))
//     : null;
//   const improvement =
//     scoreGrowth.length >= 2
//       ? Math.round((scoreGrowth.at(-1)!.score - scoreGrowth[0].score) * 10) / 10
//       : null;
//
//   return (
//     <DashboardShell
//       user={user}
//       nav={ADMIN_NAV}
//       title={student.name}
//       org={student.branch ?? undefined}
//     >
//       <div className="space-y-6">
//         <Link href="/admin/students" className="text-sm text-muted hover:text-ink">
//           ← All students
//         </Link>
//
//         <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
//           <StatCard label="Academic" value={`${student.academicPercent}%`} icon={GraduationCap} />
//           <StatCard
//             label="Best test round"
//             value={
//               best != null ? (
//                 <>
//                   {best.toFixed(1)}
//                   <span className="text-lg text-faint">/10</span>
//                 </>
//               ) : (
//                 "—"
//               )
//             }
//             accent
//             icon={Trophy}
//           />
//           <StatCard
//             label="Improvement"
//             value={
//               improvement != null
//                 ? `${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}`
//                 : "—"
//             }
//             icon={TrendingUp}
//           />
//         </section>
//
//         {scoreGrowth.length === 0 ? (
//           <div className="card p-10 text-center text-muted">
//             No completed test rounds yet — charts appear once this student sits a
//             test interview.
//           </div>
//         ) : (
//           <section className="grid gap-6 lg:grid-cols-2">
//             <div className="card p-6">
//               <h3 className="font-semibold text-ink">Test-round scores</h3>
//               <p className="mt-0.5 text-xs text-muted">
//                 Test rounds only — coaching rounds are private to the student.
//               </p>
//               <div className="mt-4">
//                 <TrendLine
//                   data={scoreGrowth.map((p): TrendPoint => ({ label: p.label, value: p.score }))}
//                   yMax={10}
//                   kinks={scoreGrowth.slice(1).map((p) => ({ at: p.label }))}
//                 />
//               </div>
//             </div>
//             {radar && (
//               <div className="card p-6">
//                 <h3 className="font-semibold text-ink">What specifically improved</h3>
//                 <p className="mt-0.5 text-xs text-muted">
//                   First test round vs latest, across the five coachable skills.
//                 </p>
//                 <div className="mt-4">
//                   <SkillRadar
//                     baseline={radar.baseline}
//                     latest={radar.latest}
//                     baselineLabel="First test"
//                     latestLabel="Latest test"
//                   />
//                 </div>
//               </div>
//             )}
//           </section>
//         )}
//
//         {radar && (
//           <section className="card p-6">
//             <h3 className="font-semibold text-ink">Where they&apos;re weakest</h3>
//             <p className="mt-0.5 text-xs text-muted">
//               Latest test round, weakest skill first — where coaching pays off.
//             </p>
//             <div className="mt-4 max-w-2xl">
//               <SkillBars bars={toSkillBars(radar.latest)} />
//             </div>
//           </section>
//         )}
//
//         {(whatWentWell.length > 0 || areasToImprove.length > 0) && (
//           <section className="card p-6">
//             <h3 className="font-semibold text-ink">From the latest test round</h3>
//             <div className="mt-4 grid gap-6 sm:grid-cols-2">
//               <div>
//                 <div className="text-xs font-medium uppercase tracking-wide text-success">
//                   Strengths
//                 </div>
//                 <ul className="mt-2 space-y-1.5 text-sm text-ink">
//                   {whatWentWell.map((w, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-success">✓</span>
//                       {w}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//               <div>
//                 <div className="text-xs font-medium uppercase tracking-wide text-warning">
//                   Still working on
//                 </div>
//                 <ul className="mt-2 space-y-1.5 text-sm text-ink">
//                   {areasToImprove.map((w, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-warning">→</span>
//                       {w}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             </div>
//           </section>
//         )}
//       </div>
//     </DashboardShell>
//   );
// }
//
