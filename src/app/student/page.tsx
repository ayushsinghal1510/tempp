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
// import { prisma } from "@/lib/db";
// import RoundTrajectory from "@/components/charts/bklit/RoundTrajectory";
// import {
//   getStudentCohorts,
//   upcomingCohorts,
//   type StudentCohort,
// } from "@/lib/queries/student";
//
// export const dynamic = "force-dynamic";
//
// const TIER_LABEL: Record<string, string> = {
//   tier_1: "Tier 1",
//   tier_2: "Tier 2",
//   tier_3: "Tier 3",
// };
//
// function daysUntil(d: Date | null): number | null {
//   if (!d) return null;
//   const ms = d.getTime() - Date.now();
//   return Math.ceil(ms / 86_400_000);
// }
//
// function whenLabel(d: Date | null): string {
//   const days = daysUntil(d);
//   if (days == null) return "Date TBD";
//   if (days < 0) return "Drive passed";
//   if (days === 0) return "Today";
//   if (days === 1) return "Tomorrow";
//   return `In ${days} days`;
// }
//
// export default async function StudentHome() {
//   const user = await requireUser(["student"]);
//   const student = await prisma.student.findUnique({
//     where: { userId: user.id },
//     select: { course: true, academicPercent: true },
//   });
//   const cohorts = await getStudentCohorts(user.id);
//   const upcoming = upcomingCohorts(cohorts);
//   const top2 = upcoming.slice(0, 2);
//
//   // Cross-company growth: your average score per company, over the season.
//   // (Scores are company-calibrated, so this is a trend, not a strict compare.)
//   const growthTimeline = cohorts
//     .map((c) => {
//       const scores = c.rounds
//         .filter((r) => r.status === "completed" && r.overallScore != null)
//         .map((r) => r.overallScore as number);
//       if (!scores.length) return null;
//       const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
//       return {
//         company: c.companyName,
//         driveDate: c.driveDate,
//         score: Math.round(avg * 10) / 10,
//       };
//     })
//     .filter((x): x is { company: string; driveDate: Date | null; score: number } => x != null)
//     .sort(
//       (a, b) =>
//         (a.driveDate ? a.driveDate.getTime() : Infinity) -
//         (b.driveDate ? b.driveDate.getTime() : Infinity),
//     )
//     .map((g) => ({ label: g.company, score: g.score }));
//
//   return (
//     <DashboardShell
//       user={user}
//       nav={STUDENT_NAV}
//       title="Dashboard"
//       org={
//         student
//           ? `${student.course ?? "Student"} · ${student.academicPercent}% academic`
//           : undefined
//       }
//       showPrivacyNote
//     >
//       <div className="space-y-8">
//         {/* ── Coming up: the next two drives, soonest first ── */}
//         <section>
//           <div className="flex items-baseline justify-between">
//             <div>
//               <h3 className="text-lg font-semibold text-ink">Coming up</h3>
//               <p className="mt-0.5 text-sm text-muted">
//                 Your next drives, soonest first. Tap one to prep.
//               </p>
//             </div>
//             {cohorts.length > 2 && (
//               <Link
//                 href="/student/companies"
//                 className="text-sm font-medium text-brand hover:underline"
//               >
//                 All companies →
//               </Link>
//             )}
//           </div>
//
//           {top2.length === 0 ? (
//             <div className="card mt-4 p-10 text-center text-muted">
//               No interviews lined up yet — your placement office will add them.
//             </div>
//           ) : (
//             <div className="mt-4 grid gap-4 md:grid-cols-2">
//               {top2.map((c) => (
//                 <UpcomingTile key={c.cohortId} c={c} />
//               ))}
//             </div>
//           )}
//         </section>
//
//         {/* ── Your growth across companies (season trend, averaged) — needs ≥2 ── */}
//         {growthTimeline.length >= 2 && (
//           <section className="card p-6">
//             <h3 className="text-lg font-semibold text-ink">Your growth across companies</h3>
//             <p className="mt-0.5 text-sm text-muted">
//               Your average score per company, in order over the season. Each
//               company sets its own bar, so read this as a trend.
//             </p>
//             <div className="mt-4 max-w-2xl">
//               <RoundTrajectory rounds={growthTimeline} />
//             </div>
//           </section>
//         )}
//
//         {/* ── All companies (compact) ── */}
//         {cohorts.length > 0 && (
//           <section>
//             <h3 className="text-lg font-semibold text-ink">Your companies</h3>
//             <p className="text-sm text-muted">
//               Each company is scored on its own rubric — we don&apos;t compare
//               across them.
//             </p>
//             <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//               {cohorts.map((c) => (
//                 <Link
//                   key={c.cohortId}
//                   href={`/student/companies/${c.cohortId}`}
//                   className="card p-5 transition hover:border-brand/40"
//                 >
//                   <div className="flex items-center justify-between">
//                     <div className="text-lg font-semibold text-ink">
//                       {c.companyName}
//                     </div>
//                     <span className="text-xs text-muted">{whenLabel(c.driveDate)}</span>
//                   </div>
//                   <div className="mt-4 flex items-baseline gap-1">
//                     <span className="text-3xl font-bold tabular-nums text-brand">
//                       {c.bestTestScore != null ? c.bestTestScore.toFixed(1) : "—"}
//                     </span>
//                     <span className="text-sm text-muted">/10 best test round</span>
//                   </div>
//                   <div className="mt-3 text-sm text-brand">Open prep →</div>
//                 </Link>
//               ))}
//             </div>
//           </section>
//         )}
//       </div>
//     </DashboardShell>
//   );
// }
//
// function UpcomingTile({ c }: { c: StudentCohort }) {
//   return (
//     <Link
//       href={`/student/companies/${c.cohortId}`}
//       className="card overflow-hidden p-6 transition hover:border-brand/40"
//     >
//       <div className="flex items-center gap-2 text-sm font-medium text-brand">
//         <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-soft text-xs">
//           {c.companyName.slice(0, 2).toUpperCase()}
//         </span>
//         {whenLabel(c.driveDate)}
//       </div>
//       <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">
//         {c.companyName}
//       </h2>
//       <p className="mt-1 text-sm text-muted">
//         {c.jobTitle ?? "Role"}
//         {c.tier ? ` · ${TIER_LABEL[c.tier]}` : ""}
//         {c.salaryLpa != null ? ` · ${c.salaryLpa} LPA` : ""}
//       </p>
//       <div className="mt-4 flex items-center gap-2">
//         {c.pendingCount > 0 ? (
//           <span className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-primary-foreground">
//             {c.pendingCount} interview{c.pendingCount > 1 ? "s" : ""} to give
//           </span>
//         ) : (
//           <span className="rounded-lg bg-success-soft px-3 py-1 text-xs font-semibold text-success">
//             All done
//           </span>
//         )}
//         <span className="text-sm text-brand">Open prep →</span>
//       </div>
//     </Link>
//   );
// }
//
