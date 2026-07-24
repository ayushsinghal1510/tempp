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
// import { getStudentCohort, type StudentCohortRound } from "@/lib/queries/student";
// import { tierProfile } from "@/lib/research/tierProfiles";
// import TrendLine from "@/components/charts/rc/TrendLine";
// import SkillRadar from "@/components/charts/bklit/SkillRadar";
// import SkillBars from "@/components/charts/bklit/SkillBars";
// import SkillRetention from "@/components/prepai/SkillRetention";
// import { toSkillBars, toRetention } from "@/lib/skills";
//
// export const dynamic = "force-dynamic";
//
// const TIER_LABEL: Record<string, string> = {
//   tier_1: "Tier 1 (>10 LPA)",
//   tier_2: "Tier 2 (4–10 LPA)",
//   tier_3: "Tier 3 (<4 LPA)",
// };
//
// function whenLabel(d: Date | null): string {
//   if (!d) return "Date TBD";
//   const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
//   if (days < 0) return "Drive passed";
//   if (days === 0) return "Today";
//   if (days === 1) return "Tomorrow";
//   return `In ${days} days`;
// }
//
// export default async function CompanyPrep({
//   params,
// }: {
//   params: Promise<{ cohortId: string }>;
// }) {
//   const { cohortId } = await params;
//   const user = await requireUser(["student"]);
//   const c = await getStudentCohort(user.id, cohortId);
//   if (!c) notFound();
//
//   const profile = tierProfile(c.tier);
//   const coaching = c.rounds.filter((r) => r.type === "coaching");
//   const test = c.rounds.filter((r) => r.type === "test");
//   const anyScored = c.rounds.some(
//     (r) => r.status === "completed" && r.overallScore != null,
//   );
//
//   // Graphs (Bklit). Two timelines: a COMBINED one (all rounds — how you
//   // performed overall) and a TEST-only one (the proctored, defensible score).
//   // Plus the skill diagnosis (radar + weakest-first bars + retention).
//   const completedAll = c.rounds
//     .filter((r) => r.status === "completed" && r.overallScore != null)
//     .sort((a, b) => a.sessionNumber - b.sessionNumber || a.roundNumber - b.roundNumber);
//   // Unique labels (session-prefixed) so points and vertical kinks don't collide.
//   const combinedTimeline = completedAll.map((r) => ({
//     label: `S${r.sessionNumber} ${r.type === "test" ? "T" : "C"}${r.roundNumber}`,
//     value: r.overallScore as number,
//   }));
//   // Vertical kinks at each new session boundary.
//   const combinedKinks: { at: string; label: string }[] = [];
//   completedAll.forEach((r, i) => {
//     if (i > 0 && r.sessionNumber !== completedAll[i - 1].sessionNumber) {
//       combinedKinks.push({
//         at: `S${r.sessionNumber} ${r.type === "test" ? "T" : "C"}${r.roundNumber}`,
//         label: `S${r.sessionNumber}`,
//       });
//     }
//   });
//   const completedTests = test
//     .filter((r) => r.status === "completed" && r.overallScore != null)
//     .sort((a, b) => a.sessionNumber - b.sessionNumber || a.roundNumber - b.roundNumber);
//   const testTimeline = completedTests.map((r) => ({
//     label: `S${r.sessionNumber} T${r.roundNumber}`,
//     value: r.overallScore as number,
//   }));
//   const testWithSkills = completedTests.filter((r) => r.skills != null);
//   const radarFirst = testWithSkills[0]?.skills ?? null;
//   const radarLast = testWithSkills.at(-1)?.skills ?? null;
//   // Retention: last coaching round's skills vs the latest test round's skills.
//   const lastCoachingSkills =
//     coaching
//       .filter((r) => r.status === "completed" && r.skills != null)
//       .sort((a, b) => a.sessionNumber - b.sessionNumber)
//       .at(-1)?.skills ?? null;
//
//   return (
//     <DashboardShell
//       user={user}
//       nav={STUDENT_NAV}
//       title={`${c.companyName} · prep`}
//       org={c.jobTitle ?? undefined}
//       showPrivacyNote
//     >
//       <div className="space-y-6">
//         <Link href="/student/companies" className="text-sm text-muted hover:text-ink">
//           ← Companies
//         </Link>
//
//         {/* Header */}
//         <section className="card p-6">
//           <div className="flex flex-wrap items-start justify-between gap-3">
//             <div>
//               <h2 className="text-2xl font-bold text-ink">{c.companyName}</h2>
//               {c.jobTitle && <p className="mt-0.5 text-sm text-muted">{c.jobTitle}</p>}
//             </div>
//             <div className="flex flex-wrap items-center gap-2">
//               <span className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
//                 {whenLabel(c.driveDate)}
//               </span>
//               {c.tier && (
//                 <span className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-muted">
//                   {TIER_LABEL[c.tier]}
//                 </span>
//               )}
//             </div>
//           </div>
//           {c.research?.about && (
//             <p className="mt-3 max-w-3xl text-sm text-ink">{c.research.about}</p>
//           )}
//         </section>
//
//         <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
//           {/* ── LEFT: your interviews + analytics ── */}
//           <div className="space-y-6">
//             {/* Your progress — two timelines (overall + test) then the skill diagnosis */}
//             {(combinedTimeline.length > 0 || radarLast != null) && (
//               <section className="card p-6">
//                 <h3 className="font-semibold text-ink">Your progress</h3>
//                 <p className="mt-0.5 text-xs text-muted">
//                   How you performed across your rounds, and how your five skills
//                   look now.
//                 </p>
//                 {combinedTimeline.length > 0 && (
//                   <div className="mt-4 grid gap-6 sm:grid-cols-2">
//                     <div>
//                       <div className="text-xs font-medium uppercase tracking-wide text-faint">
//                         Overall performance (all rounds)
//                       </div>
//                       <div className="mt-2">
//                         <TrendLine data={combinedTimeline} yMax={10} kinks={combinedKinks} height={200} />
//                       </div>
//                     </div>
//                     <div>
//                       <div className="text-xs font-medium uppercase tracking-wide text-faint">
//                         Test performance (proctored)
//                       </div>
//                       <div className="mt-2">
//                         {testTimeline.length > 0 ? (
//                           <TrendLine data={testTimeline} yMax={10} height={200} />
//                         ) : (
//                           <p className="pt-8 text-center text-sm text-muted">
//                             No completed test rounds yet.
//                           </p>
//                         )}
//                       </div>
//                     </div>
//                   </div>
//                 )}
//                 {radarLast != null && (
//                   <div className="mt-6 grid gap-6 sm:grid-cols-2">
//                     <div>
//                       <div className="text-xs font-medium uppercase tracking-wide text-faint">
//                         Your skills (first vs latest test)
//                       </div>
//                       <div className="mt-2">
//                         <SkillRadar
//                           baseline={radarFirst ?? radarLast}
//                           latest={radarLast}
//                           baselineLabel={radarFirst && radarFirst !== radarLast ? "First test" : "Baseline"}
//                           latestLabel="Latest test"
//                         />
//                       </div>
//                     </div>
//                     <div>
//                       <div className="text-xs font-medium uppercase tracking-wide text-faint">
//                         Work on these first
//                       </div>
//                       <div className="mt-2">
//                         <SkillBars bars={toSkillBars(radarLast)} />
//                       </div>
//                     </div>
//                   </div>
//                 )}
//                 {lastCoachingSkills != null && radarLast != null && (
//                   <div className="mt-6">
//                     <div className="text-xs font-medium uppercase tracking-wide text-faint">
//                       Did it stick?
//                     </div>
//                     <p className="mt-0.5 text-xs text-muted">
//                       Where coaching left each skill vs. how it held up under test
//                       pressure.
//                     </p>
//                     <div className="mt-3">
//                       <SkillRetention rows={toRetention(lastCoachingSkills, radarLast)} />
//                     </div>
//                   </div>
//                 )}
//               </section>
//             )}
//
//             <section className="card p-6">
//               <h3 className="font-semibold text-ink">Your interviews</h3>
//               <p className="mt-0.5 text-xs text-muted">
//                 3 coaching rounds (private to you) and 2 test rounds. Start a
//                 pending one, or review a finished one.
//               </p>
//               <div className="mt-4 space-y-2">
//                 {[...coaching, ...test].map((r) => (
//                   <RoundRow key={r.id} r={r} />
//                 ))}
//               </div>
//             </section>
//
//             {/* Your scores — real round scores (both kinds are yours to see) */}
//             <section className="card p-6">
//               <h3 className="font-semibold text-ink">Your scores</h3>
//               {anyScored ? (
//                 <div className="mt-4 grid gap-6 sm:grid-cols-2">
//                   <ScoreColumn label="Coaching (practice)" rounds={coaching} />
//                   <ScoreColumn label="Test (proof)" rounds={test} />
//                 </div>
//               ) : (
//                 <p className="mt-3 text-sm text-muted">
//                   Give an interview to see your scores and where you&apos;re
//                   improving.
//                 </p>
//               )}
//             </section>
//           </div>
//
//           {/* ── RIGHT: what to expect ── */}
//           <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
//             {profile && (
//               <section className="card p-6">
//                 <h3 className="font-semibold text-ink">What this tier expects</h3>
//                 <p className="mt-1 text-sm text-muted">{profile.bar}</p>
//                 <ul className="mt-3 space-y-1.5 text-sm text-ink">
//                   {profile.studentExpectations.slice(0, 4).map((e, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-brand">•</span>
//                       {e}
//                     </li>
//                   ))}
//                 </ul>
//               </section>
//             )}
//
//             {c.research &&
//               (c.research.signatureTopics?.length > 0 ||
//                 c.research.interviewStyle) && (
//                 <section className="card p-6">
//                   <h3 className="font-semibold text-ink">
//                     What {c.companyName} asks
//                   </h3>
//                   {c.research.interviewStyle && (
//                     <p className="mt-1 text-sm text-muted">
//                       {c.research.interviewStyle}
//                     </p>
//                   )}
//                   {c.research.signatureTopics?.length > 0 && (
//                     <div className="mt-3 flex flex-wrap gap-2">
//                       {c.research.signatureTopics.map((t, i) => (
//                         <span
//                           key={i}
//                           className="rounded-full border border-line px-3 py-1 text-xs text-ink"
//                         >
//                           {t}
//                         </span>
//                       ))}
//                     </div>
//                   )}
//                 </section>
//               )}
//
//             {c.skillPriorities.length > 0 && (
//               <section className="card p-6">
//                 <h3 className="font-semibold text-ink">Skills they weigh most</h3>
//                 <div className="mt-3 flex flex-wrap gap-2">
//                   {c.skillPriorities.slice(0, 3).map((s) => (
//                     <span
//                       key={s}
//                       className="rounded-lg bg-brand-soft px-3 py-1 text-xs font-semibold text-brand"
//                     >
//                       {s}
//                     </span>
//                   ))}
//                 </div>
//               </section>
//             )}
//
//             {c.jobDescription && (
//               <section className="card p-6">
//                 <details>
//                   <summary className="cursor-pointer font-semibold text-ink">
//                     Job description
//                   </summary>
//                   <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
//                     {c.jobDescription}
//                   </p>
//                 </details>
//               </section>
//             )}
//           </aside>
//         </div>
//       </div>
//     </DashboardShell>
//   );
// }
//
// function RoundRow({ r }: { r: StudentCohortRound }) {
//   const label =
//     r.type === "coaching"
//       ? `Coaching ${r.roundNumber}`
//       : `Test ${r.roundNumber}`;
//   const done = r.status === "completed";
//   const startable = r.status === "pending" || r.status === "in_progress";
//   return (
//     <div className="flex items-center justify-between rounded-lg border border-line px-4 py-2.5">
//       <span className="text-sm text-ink">
//         {label}
//         {r.type === "coaching" && (
//           <span className="ml-2 text-xs text-faint">private</span>
//         )}
//       </span>
//       <span className="flex items-center gap-4 text-sm">
//         {done && r.overallScore != null && (
//           <span className="tabular-nums text-muted">
//             {r.overallScore.toFixed(1)}/10
//           </span>
//         )}
//         {startable ? (
//           <Link
//             href={`/student/rounds/${r.id}/brief`}
//             className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-brand-strong"
//           >
//             {r.status === "in_progress" ? "Resume" : "Start"}
//           </Link>
//         ) : done ? (
//           <Link
//             href={`/student/rounds/${r.id}`}
//             className="text-xs font-medium text-brand hover:underline"
//           >
//             View replay →
//           </Link>
//         ) : (
//           <span className="text-xs text-faint capitalize">{r.status}</span>
//         )}
//       </span>
//     </div>
//   );
// }
//
// function ScoreColumn({
//   label,
//   rounds,
// }: {
//   label: string;
//   rounds: StudentCohortRound[];
// }) {
//   const scored = rounds.filter(
//     (r) => r.status === "completed" && r.overallScore != null,
//   );
//   return (
//     <div>
//       <div className="text-xs font-semibold uppercase tracking-wide text-faint">
//         {label}
//       </div>
//       {scored.length === 0 ? (
//         <p className="mt-2 text-sm text-muted">Not yet.</p>
//       ) : (
//         <ul className="mt-2 space-y-2">
//           {scored.map((r) => (
//             <li key={r.id} className="flex items-center gap-3">
//               <span className="w-16 text-sm text-muted">
//                 {r.type === "coaching" ? "Coaching" : "Test"} {r.roundNumber}
//               </span>
//               <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
//                 <span
//                   className="block h-full rounded-full bg-brand"
//                   style={{ width: `${((r.overallScore ?? 0) / 10) * 100}%` }}
//                 />
//               </span>
//               <span className="w-12 text-right text-sm font-semibold tabular-nums text-ink">
//                 {(r.overallScore ?? 0).toFixed(1)}
//               </span>
//             </li>
//           ))}
//         </ul>
//       )}
//     </div>
//   );
// }
//
