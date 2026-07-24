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
// import { STUDENT_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
// import { tierProfile } from "@/lib/research/tierProfiles";
// import type { CompanyResearch } from "@/lib/research/companyResearch";
//
// export const dynamic = "force-dynamic";
//
// // The "in-between" page: before jumping into the interview, the student reads
// // what THIS company asks (per-cohort research, left) and what the TIER expects
// // and how the round works (hardcoded tier brief, right side).
// export default async function BriefPage({
//   params,
// }: {
//   params: Promise<{ id: string }>;
// }) {
//   const { id } = await params;
//   const user = await requireUser(["student"]);
//
//   const round = await prisma.round.findUnique({
//     where: { id },
//     include: {
//       session: {
//         include: {
//           student: true,
//           cohort: { include: { vacancies: true } },
//         },
//       },
//     },
//   });
//
//   if (!round || round.session.student.userId !== user.id) notFound();
//   if (round.status === "completed") notFound();
//
//   const cohort = round.session.cohort;
//   const vacancy = cohort.vacancies[0];
//   const profile = tierProfile(vacancy?.tier);
//   const research = (cohort.companyResearch as CompanyResearch | null) ?? null;
//   const skillPriorities = Array.isArray(vacancy?.skillPriorities)
//     ? (vacancy?.skillPriorities as string[])
//     : [];
//
//   const isTest = round.type === "test";
//   const kindLabel = isTest
//     ? `Test round ${round.roundNumber}`
//     : `Coaching round ${round.roundNumber}`;
//
//   return (
//     <DashboardShell
//       user={user}
//       nav={STUDENT_NAV}
//       title={`${cohort.companyName} · ${kindLabel}`}
//       org="Interview briefing"
//     >
//       <div className="space-y-6">
//         <Link href="/student" className="text-sm text-muted hover:text-ink">
//           ← Dashboard
//         </Link>
//
//         {/* Header */}
//         <section className="card p-6">
//           <div className="flex flex-wrap items-start justify-between gap-3">
//             <div>
//               <h2 className="text-2xl font-bold text-ink">
//                 {cohort.companyName}
//               </h2>
//               {vacancy?.jobTitle && (
//                 <p className="mt-0.5 text-sm text-muted">{vacancy.jobTitle}</p>
//               )}
//             </div>
//             <div className="flex items-center gap-2">
//               <span
//                 className={`rounded-lg px-3 py-1 text-xs font-semibold ${
//                   isTest
//                     ? "bg-warning-soft text-warning"
//                     : "bg-brand-soft text-brand"
//                 }`}
//               >
//                 {isTest ? "Test — measured" : "Coaching — you'll be coached"}
//               </span>
//               {profile && (
//                 <span className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-muted">
//                   {profile.label} · {profile.salaryBand}
//                 </span>
//               )}
//             </div>
//           </div>
//           {research?.about && (
//             <p className="mt-3 text-sm text-ink">{research.about}</p>
//           )}
//           {research?.domain && (
//             <p className="mt-1 text-xs text-muted">{research.domain}</p>
//           )}
//         </section>
//
//         <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
//           {/* ── LEFT: what THIS company asks (per-cohort research) ── */}
//           <div className="space-y-6">
//             {research &&
//               (research.signatureTopics.length > 0 ||
//                 research.sampleQuestions.length > 0 ||
//                 research.interviewStyle) && (
//                 <section className="card p-6">
//                   <h3 className="font-semibold text-ink">
//                     What {cohort.companyName} tends to ask
//                   </h3>
//                   {research.interviewStyle && (
//                     <p className="mt-1 text-sm text-muted">
//                       {research.interviewStyle}
//                     </p>
//                   )}
//                   {research.signatureTopics.length > 0 && (
//                     <div className="mt-4 flex flex-wrap gap-2">
//                       {research.signatureTopics.map((t, i) => (
//                         <span
//                           key={i}
//                           className="rounded-full border border-line px-3 py-1 text-xs text-ink"
//                         >
//                           {t}
//                         </span>
//                       ))}
//                     </div>
//                   )}
//                   {research.sampleQuestions.length > 0 && (
//                     <ul className="mt-4 space-y-1.5 text-sm text-ink">
//                       {research.sampleQuestions.map((q, i) => (
//                         <li key={i} className="flex gap-2">
//                           <span className="text-brand">?</span>
//                           {q}
//                         </li>
//                       ))}
//                     </ul>
//                   )}
//                 </section>
//               )}
//
//             {research && research.values.length > 0 && (
//               <section className="card p-6">
//                 <h3 className="font-semibold text-ink">What they value</h3>
//                 <ul className="mt-3 space-y-1.5 text-sm text-ink">
//                   {research.values.map((v, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-success">✓</span>
//                       {v}
//                     </li>
//                   ))}
//                 </ul>
//               </section>
//             )}
//
//             {research && research.techStack.length > 0 && (
//               <section className="card p-6">
//                 <h3 className="font-semibold text-ink">Their stack</h3>
//                 <div className="mt-3 flex flex-wrap gap-2">
//                   {research.techStack.map((t, i) => (
//                     <span
//                       key={i}
//                       className="rounded-md bg-canvas px-2.5 py-1 text-xs text-ink"
//                     >
//                       {t}
//                     </span>
//                   ))}
//                 </div>
//               </section>
//             )}
//
//             {/* How you'll be measured */}
//             <section className="card p-6">
//               <h3 className="font-semibold text-ink">How you&apos;ll be measured</h3>
//               <p className="mt-0.5 text-sm text-muted">
//                 Every answer is scored on five coachable skills.
//                 {skillPriorities.length > 0
//                   ? " This company weighs these most:"
//                   : ""}
//               </p>
//               {skillPriorities.length > 0 && (
//                 <div className="mt-3 flex flex-wrap gap-2">
//                   {skillPriorities.slice(0, 3).map((s, i) => (
//                     <span
//                       key={i}
//                       className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand"
//                     >
//                       {s}
//                     </span>
//                   ))}
//                 </div>
//               )}
//               {profile && profile.whatGoodLooksLike.length > 0 && (
//                 <ul className="mt-4 space-y-1.5 text-sm text-ink">
//                   {profile.whatGoodLooksLike.map((g, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-brand">→</span>
//                       {g}
//                     </li>
//                   ))}
//                 </ul>
//               )}
//             </section>
//           </div>
//
//           {/* ── RIGHT: the tier brief (hardcoded, done once) ── */}
//           {profile && (
//             <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
//               <section className="card p-6">
//                 <div className="text-xs font-medium uppercase tracking-wide text-faint">
//                   {profile.label} · {profile.salaryBand}
//                 </div>
//                 <h3 className="mt-1 font-semibold text-ink">
//                   What this tier expects
//                 </h3>
//                 <p className="mt-1 text-sm text-muted">{profile.bar}</p>
//                 <ul className="mt-4 space-y-1.5 text-sm text-ink">
//                   {profile.studentExpectations.map((e, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-brand">•</span>
//                       {e}
//                     </li>
//                   ))}
//                 </ul>
//               </section>
//
//               <section className="card p-6">
//                 <h3 className="font-semibold text-ink">How your interviewer will talk</h3>
//                 <p className="mt-1 text-sm text-muted">
//                   {profile.interviewerStyle}
//                 </p>
//               </section>
//
//               <section className="card p-6">
//                 <h3 className="font-semibold text-ink">How the round flows</h3>
//                 <ol className="mt-3 space-y-2 text-sm text-ink">
//                   {profile.questionFlow.map((q, i) => (
//                     <li key={i} className="flex gap-2.5">
//                       <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-canvas text-xs font-semibold text-muted">
//                         {i + 1}
//                       </span>
//                       {q}
//                     </li>
//                   ))}
//                 </ol>
//               </section>
//
//               {/* The objective for THIS round kind, with the other for context */}
//               <section
//                 className={`card p-6 ${
//                   isTest ? "" : "ring-1 ring-brand/30"
//                 }`}
//               >
//                 <h3 className="font-semibold text-ink">
//                   What this round is for
//                 </h3>
//                 <div className="mt-3 space-y-3 text-sm">
//                   <div
//                     className={
//                       isTest ? "opacity-60" : "rounded-lg bg-brand-soft p-3"
//                     }
//                   >
//                     <div className="text-xs font-semibold uppercase tracking-wide text-brand">
//                       Coaching rounds
//                     </div>
//                     <p className="mt-1 text-ink">{profile.coachingObjective}</p>
//                   </div>
//                   <div
//                     className={
//                       isTest ? "rounded-lg bg-warning-soft p-3" : "opacity-60"
//                     }
//                   >
//                     <div className="text-xs font-semibold uppercase tracking-wide text-warning">
//                       Test rounds
//                     </div>
//                     <p className="mt-1 text-ink">{profile.testingObjective}</p>
//                   </div>
//                 </div>
//               </section>
//             </aside>
//           )}
//         </div>
//
//         {/* CTA */}
//         <div className="flex items-center gap-3">
//           <Link
//             href={`/student/rounds/${round.id}/live`}
//             className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
//           >
//             Begin interview →
//           </Link>
//           <Link href="/student" className="text-sm text-muted hover:text-ink">
//             Not yet
//           </Link>
//         </div>
//       </div>
//     </DashboardShell>
//   );
// }
//
