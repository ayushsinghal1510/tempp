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
// import { ADMIN_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
// import { tierProfile } from "@/lib/research/tierProfiles";
// import type { CompanyResearch } from "@/lib/research/companyResearch";
// import MispricingScatter from "@/components/charts/rc/MispricingScatter";
// import SkillBars from "@/components/charts/bklit/SkillBars";
// import { quadrantOf, type ScatterPoint } from "@/lib/fixtures";
// import { toSkillBars, type SkillMap } from "@/lib/skills";
//
// export const dynamic = "force-dynamic";
//
// const TIER_LABEL: Record<string, string> = {
//   tier_1: "Tier 1 (>10 LPA)",
//   tier_2: "Tier 2 (4–10 LPA)",
//   tier_3: "Tier 3 (<4 LPA)",
// };
//
// const SKILL_ORDER = ["framing", "ownership", "quantification", "concision", "approach"] as const;
//
// export default async function CohortDetail({
//   params,
// }: {
//   params: Promise<{ id: string }>;
// }) {
//   const { id } = await params;
//   const user = await requireUser(["admin"]);
//
//   const cohort = await prisma.cohort.findUnique({
//     where: { id },
//     include: {
//       vacancies: true,
//       sessions: {
//         include: {
//           student: true,
//           // PRIVACY: admins only ever see TEST rounds — coaching stays private.
//           rounds: {
//             where: { type: "test" },
//             orderBy: { roundNumber: "asc" },
//             select: {
//               status: true,
//               overallScore: true,
//               roundNumber: true,
//               scores: {
//                 select: {
//                   framing: true,
//                   ownership: true,
//                   quantification: true,
//                   concision: true,
//                   approach: true,
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   });
//
//   // Only the owning university's admin can open this cohort.
//   if (!cohort || cohort.universityId !== user.universityId) notFound();
//
//   const v = cohort.vacancies[0];
//   const profile = tierProfile(v?.tier);
//   const research = (cohort.companyResearch as CompanyResearch | null) ?? null;
//
//   // Per-student aggregation — a student may have >1 session at this cohort, so
//   // merge them into one row (dedup) for both the roster and the graphs.
//   type SkillVec = { framing: number; ownership: number; quantification: number; concision: number; approach: number };
//   const byStudent = new Map<
//     string,
//     {
//       id: string;
//       name: string;
//       rollNumber: string | null;
//       academicPercent: number;
//       best: number | null;
//       testDone: number;
//       testTotal: number;
//       latestSkills: SkillVec | null;
//     }
//   >();
//   for (const s of cohort.sessions) {
//     const scored = s.rounds.filter((r) => r.status === "completed" && r.overallScore != null);
//     const best = scored.length ? Math.max(...scored.map((r) => r.overallScore as number)) : null;
//     const latestSkills =
//       (s.rounds.filter((r) => r.status === "completed" && r.scores).at(-1)?.scores as SkillVec | undefined) ?? null;
//     const cur = byStudent.get(s.student.id) ?? {
//       id: s.student.id,
//       name: s.student.name,
//       rollNumber: s.student.rollNumber,
//       academicPercent: s.student.academicPercent,
//       best: null as number | null,
//       testDone: 0,
//       testTotal: 0,
//       latestSkills: null as SkillVec | null,
//     };
//     if (best != null && (cur.best == null || best > cur.best)) cur.best = best;
//     cur.testDone += s.rounds.filter((r) => r.status === "completed").length;
//     cur.testTotal += s.rounds.length;
//     if (latestSkills) cur.latestSkills = latestSkills;
//     byStudent.set(s.student.id, cur);
//   }
//   const students = [...byStudent.values()];
//   const roster = students;
//   const anyScored = roster.some((r) => r.best != null);
//
//   const scatterPoints: ScatterPoint[] = students
//     .filter((s) => s.best != null)
//     .map((s) => ({
//       studentId: s.id,
//       name: s.name,
//       academic: s.academicPercent,
//       score: s.best as number,
//       quadrant: quadrantOf(s.academicPercent, s.best as number),
//     }));
//   const skillVecs = students.map((s) => s.latestSkills).filter((v): v is SkillVec => v != null);
//   const cohortSkillAvg: SkillMap | null = skillVecs.length
//     ? (Object.fromEntries(
//         SKILL_ORDER.map((k) => [k, skillVecs.reduce((a, v) => a + v[k], 0) / skillVecs.length]),
//       ) as SkillMap)
//     : null;
//
//   return (
//     <DashboardShell
//       user={user}
//       nav={ADMIN_NAV}
//       title={`${cohort.companyName} cohort`}
//       org={`${roster.length} students${v?.jobTitle ? ` · ${v.jobTitle}` : ""}`}
//     >
//       <div className="space-y-6">
//         <Link href="/admin/cohorts" className="text-sm text-muted hover:text-ink">
//           ← All cohorts
//         </Link>
//
//         {/* Header */}
//         <section className="card p-6">
//           <div className="flex flex-wrap items-start justify-between gap-3">
//             <div>
//               <h2 className="text-2xl font-bold text-ink">{cohort.companyName}</h2>
//               {v?.jobTitle && (
//                 <p className="mt-0.5 text-sm text-muted">{v.jobTitle}</p>
//               )}
//             </div>
//             <div className="flex flex-wrap items-center gap-2">
//               {v?.tier && (
//                 <span className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
//                   {TIER_LABEL[v.tier]}
//                 </span>
//               )}
//               <span className="rounded-lg border border-line px-3 py-1 text-xs font-medium capitalize text-muted">
//                 {cohort.status}
//               </span>
//             </div>
//           </div>
//           {research?.about && (
//             <p className="mt-3 max-w-3xl text-sm text-ink">{research.about}</p>
//           )}
//           {v?.jobDescription && (
//             <details className="mt-3">
//               <summary className="cursor-pointer text-sm font-medium text-brand">
//                 Job description
//               </summary>
//               <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
//                 {v.jobDescription}
//               </p>
//             </details>
//           )}
//         </section>
//
//         {/* What this company asks (per-cohort research) */}
//         {research &&
//           (research.signatureTopics?.length > 0 ||
//             research.sampleQuestions?.length > 0 ||
//             research.interviewStyle) && (
//             <section className="card p-6">
//               <h3 className="font-semibold text-ink">
//                 What {cohort.companyName} asks
//               </h3>
//               {research.interviewStyle && (
//                 <p className="mt-1 text-sm text-muted">{research.interviewStyle}</p>
//               )}
//               {research.signatureTopics?.length > 0 && (
//                 <div className="mt-4 flex flex-wrap gap-2">
//                   {research.signatureTopics.map((t, i) => (
//                     <span
//                       key={i}
//                       className="rounded-full border border-line px-3 py-1 text-xs text-ink"
//                     >
//                       {t}
//                     </span>
//                   ))}
//                 </div>
//               )}
//             </section>
//           )}
//
//         {/* Cohort graphs — mispricing + where the cohort is weak (test rounds only) */}
//         {anyScored && (
//           <section className="grid gap-6 lg:grid-cols-2">
//             <div className="card p-6">
//               <h3 className="font-semibold text-ink">Who is under-sent?</h3>
//               <p className="mt-0.5 text-xs text-muted">
//                 Academic standing vs. best test score. Bottom-right = strong on
//                 paper, needs interview reps.
//               </p>
//               <div className="mt-4">
//                 <MispricingScatter points={scatterPoints} />
//               </div>
//             </div>
//             {cohortSkillAvg && (
//               <div className="card p-6">
//                 <h3 className="font-semibold text-ink">Where the cohort is weakest</h3>
//                 <p className="mt-0.5 text-xs text-muted">
//                   Average across students&apos; latest test round, weakest skill
//                   first — what to coach next.
//                 </p>
//                 <div className="mt-4">
//                   <SkillBars bars={toSkillBars(cohortSkillAvg)} />
//                 </div>
//               </div>
//             )}
//           </section>
//         )}
//
//         {/* Roster + test progress (privacy: test rounds only) */}
//         <section className="card overflow-hidden">
//           <div className="border-b border-line px-6 py-4">
//             <h3 className="font-semibold text-ink">Enrolled students</h3>
//             <p className="mt-0.5 text-xs text-muted">
//               Test rounds only — coaching rounds stay private to each student.
//             </p>
//           </div>
//           {roster.length === 0 ? (
//             <div className="p-10 text-center text-muted">
//               No students enrolled.
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-sm">
//                 <thead>
//                   <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
//                     <th className="px-6 py-2.5 font-medium">Student</th>
//                     <th className="px-6 py-2.5 font-medium">Academic %</th>
//                     <th className="px-6 py-2.5 font-medium">Test rounds</th>
//                     <th className="px-6 py-2.5 font-medium">Best test score</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {roster.map((r) => (
//                     <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
//                       <td className="px-6 py-3 font-medium">
//                         <Link
//                           href={`/admin/students/${r.id}`}
//                           className="text-brand hover:underline"
//                         >
//                           {r.name}
//                         </Link>
//                         {r.rollNumber && (
//                           <span className="ml-1 text-xs font-normal text-muted">
//                             {r.rollNumber}
//                           </span>
//                         )}
//                       </td>
//                       <td className="px-6 py-3 tabular-nums text-muted">
//                         {r.academicPercent}%
//                       </td>
//                       <td className="px-6 py-3 tabular-nums text-muted">
//                         {r.testDone}/{r.testTotal}
//                       </td>
//                       <td className="px-6 py-3 tabular-nums">
//                         {r.best != null ? `${r.best.toFixed(1)}/10` : "—"}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//           {!anyScored && roster.length > 0 && (
//             <div className="border-t border-line px-6 py-3 text-xs text-muted">
//               No test interviews completed yet — scores and the mispricing view
//               appear here once students finish their test rounds.
//             </div>
//           )}
//         </section>
//       </div>
//     </DashboardShell>
//   );
// }
//
